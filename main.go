package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/signal"
	"path"
	"syscall"
	"text/template"
	"time"

	"github.com/bwmarrin/discordgo"
	"github.com/mplewis/figyr"
	"github.com/sashabaranov/go-openai"

	_ "github.com/joho/godotenv/autoload"
)

const desc = "Create Discord events using natural language."

const templateDir = "templates"
const threadTitleChars = 80

var threadArchiveDuration = 24 * time.Hour

var createEventTmpl *template.Template
var editEventTmpl *template.Template
var openAIClient *openai.Client

type Config struct {
	DiscordBotToken string `figyr:"required,description=Your bot's Discord API token"`
	BindChannelName string `figyr:"default=eventbot,description=The name of the channel in which this bot will listen"`
	OpenaiApiKey    string `figyr:"required,description=Your OpenAI API key"`
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}

func mustParseTemplate(name string) *template.Template {
	tmpl, err := template.ParseFiles(path.Join(templateDir, fmt.Sprintf("%s.tmpl", name)))
	check(err)
	return tmpl
}

func main() {
	createEventTmpl = mustParseTemplate("prompt-create-event")
	editEventTmpl = mustParseTemplate("prompt-edit-event")

	var c Config
	figyr.New(desc).MustParse(&c)

	openAIClient = openai.NewClient(c.OpenaiApiKey)

	dg, err := discordgo.New(fmt.Sprintf("Bot %s", c.DiscordBotToken))
	check(err)
	dg.AddHandler(buildListener(c))
	check(dg.Open())
	fmt.Println("Bot is online.")

	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sc
	dg.Close()
}

func buildListener(cfg Config) func(s *discordgo.Session, m *discordgo.MessageCreate) {
	listen := func(s *discordgo.Session, m *discordgo.MessageCreate) {
		if m.Author.ID == s.State.User.ID {
			return
		}
		if len(m.Content) == 0 {
			return
		}
		c, err := s.Channel(m.ChannelID)
		if err != nil {
			fmt.Println(err)
			return
		}
		if c.Name != cfg.BindChannelName {
			return
		}

		// thread, err := s.MessageThreadStart(m.ChannelID, m.ID, fmt.Sprintf("EventBot: %s", m.Content)[:80], int(threadArchiveDuration.Minutes()))
		if err != nil {
			// XXX
		}

		_, err = s.ChannelMessageSend(m.ChannelID, "Thinking...")
		if err != nil {
			fmt.Println(err)
		}

		msg, err := runInference(PromptBody{Time: time.Now(), Message: m.Content})
		if err != nil {
			fmt.Println(err)
			msg = fmt.Sprintf("Sorry, something went wrong:\n```%s```", err)
		}

		_, err = s.ChannelMessageSend(m.ChannelID, msg)
		if err != nil {
			fmt.Println(err)
		}
	}
	return listen
}

type PromptBody struct {
	Time    time.Time
	Message string
}

func runInference(body PromptBody) (string, error) {
	var prompt bytes.Buffer
	err := createEventTmpl.Execute(&prompt, struct{ DateWithTZ string }{DateWithTZ: body.Time.Format("Monday, January 2, 2006, 15:04 MST")})
	if err != nil {
		return "", fmt.Errorf("error executing template: %w", err)
	}

	resp, err := openAIClient.CreateChatCompletion(
		context.Background(),
		openai.ChatCompletionRequest{
			Model: openai.GPT3Dot5Turbo,
			Messages: []openai.ChatCompletionMessage{
				{Role: openai.ChatMessageRoleSystem, Content: prompt.String()},
				{Role: openai.ChatMessageRoleUser, Content: body.Message},
			},
		},
	)
	if err != nil {
		return "", fmt.Errorf("error creating chat completion: %w", err)
	}

	return resp.Choices[0].Message.Content, nil
}
