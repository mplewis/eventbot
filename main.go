package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"text/template"
	"time"

	"github.com/bwmarrin/discordgo"
	"github.com/k0kubun/pp/v3"
	"github.com/mplewis/figyr"
	"github.com/sashabaranov/go-openai"

	_ "github.com/joho/godotenv/autoload"
)

const desc = "Create Discord events using natural language."

const templateDir = "templates"
const threadTitleChars = 80
const irrelevantSentinel = "EVENT_DATA_NOT_FOUND"
const humanReadableTimeFormat = "Monday, January 2, 2006, 15:04 MST"

var threadArchiveDuration = 24 * time.Hour

var promptCreateEventTmpl *template.Template
var promptEditEventTmpl *template.Template
var proposedEventTmpl *template.Template
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
	promptCreateEventTmpl = mustParseTemplate("prompt-create-event")
	promptEditEventTmpl = mustParseTemplate("prompt-edit-event")

	var c Config
	figyr.New(desc).MustParse(&c)

	openAIClient = openai.NewClient(c.OpenaiApiKey)

	dg, err := discordgo.New(fmt.Sprintf("Bot %s", c.DiscordBotToken))
	check(err)
	dg.AddHandler(buildListener(c))
	dg.AddHandler(func(s *discordgo.Session, i *discordgo.InteractionCreate) {
		pp.Println(i)
		pp.Println(i.Interaction.Message.Content)
	})
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

		pp.Println(*m)

		c, err := s.Channel(m.ChannelID)
		if err != nil {
			fmt.Println(err)
			return
		}
		if c.Name != cfg.BindChannelName {
			return
		}

		// thread, err := s.MessageThreadStart(m.ChannelID, m.ID, fmt.Sprintf("EventBot: %s", m.Content)[:80], int(threadArchiveDuration.Minutes()))
		// if err != nil {
		// 	// XXX
		// }

		// _, err = s.ChannelMessageSendComplex(m.ChannelID, &discordgo.MessageSend{
		// 	Content: "Hello world!",
		// 	Components: []discordgo.MessageComponent{
		// 		discordgo.ActionsRow{
		// 			Components: []discordgo.MessageComponent{
		// 				discordgo.Button{
		// 					Style:    discordgo.SuccessButton,
		// 					Label:    "Create",
		// 					CustomID: fmt.Sprintf("create:%s", m.ID),
		// 				},
		// 			},
		// 		},
		// 	}})
		// if err != nil {
		// 	fmt.Println(err)
		// }

		_, err = s.ChannelMessageSend(m.ChannelID, "Thinking...")
		if err != nil {
			fmt.Println(err)
		}

		relevant, parsed, err := parseNewEventData(NewEventParams{Time: time.Now(), Message: m.Content})

		pp.Println(parsed)

		var msg string
		if err != nil {
			fmt.Println(err)
			msg = fmt.Sprintf("Sorry, something went wrong:\n```%s```", err)
		} else if !relevant {
			msg = fmt.Sprintf("Sorry, that didn't look like an event to me.")
		} else {
			d := time.Now()
			if parsed.Date != "" {
				d, err = time.Parse(time.RFC3339, parsed.Date)
				if err != nil {
					fmt.Println(err)
					msg = fmt.Sprintf("Sorry, something went wrong:\n```%s```", err)
					return
				}
			}

			var buf bytes.Buffer
			err = proposedEventTmpl.Execute(&buf, struct {
				Name     string
				Date     string
				Location string
				URL      string
				Desc     string
			}{
				Name:     parsed.Name,
				Date:     d.Format(humanReadableTimeFormat),
				Location: parsed.Location,
				URL:      parsed.URL,
				Desc:     parsed.Message,
			})
			if err != nil {
				fmt.Println(err)
				msg = fmt.Sprintf("Sorry, something went wrong:\n```%s```", err)
				return
			}
			msg = buf.String()
		}

		_, err = s.ChannelMessageSendComplex(m.ChannelID, &discordgo.MessageSend{
			Content: msg,
			// Components: []discordgo.MessageComponent{
			// 	discordgo.ActionsRow{
			// 		Components: []discordgo.MessageComponent{
			// 			discordgo.Button{
			// 				Style:    discordgo.SuccessButton,
			// 				Label:    "Create",
			// 				CustomID: fmt.Sprintf("create:%s", m.ID),
			// 			},
			// 		},
			// 	},
			// },
		})
		if err != nil {
			fmt.Println(err)
		}
	}
	return listen
}

type NewEventParams struct {
	Time    time.Time
	Message string
}

type NewEventData struct {
	Message  string
	Name     string `json:"name"`
	Date     string `json:"date"`
	Location string `json:"location"`
	URL      string `json:"url"`
}

func parseNewEventData(p NewEventParams) (bool, NewEventData, error) {
	var prompt bytes.Buffer
	var data NewEventData
	err := promptCreateEventTmpl.Execute(&prompt, struct{ DateWithTZ string }{DateWithTZ: p.Time.Format(humanReadableTimeFormat)})
	if err != nil {
		return false, data, fmt.Errorf("error executing template: %w", err)
	}

	resp, err := openAIClient.CreateChatCompletion(
		context.Background(),
		openai.ChatCompletionRequest{
			Model: openai.GPT3Dot5Turbo,
			Messages: []openai.ChatCompletionMessage{
				{Role: openai.ChatMessageRoleSystem, Content: prompt.String()},
				{Role: openai.ChatMessageRoleUser, Content: p.Message},
			},
		},
	)
	if err != nil {
		return false, data, fmt.Errorf("error creating chat completion: %w", err)
	}

	content := resp.Choices[0].Message.Content
	fmt.Println(content)
	notAnEvent := strings.Contains(content, irrelevantSentinel)
	if notAnEvent {
		return false, data, nil
	}

	json.Unmarshal([]byte(content), &data)
	return true, data, nil
}
