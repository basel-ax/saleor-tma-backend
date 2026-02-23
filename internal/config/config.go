package config

import (
	"errors"
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	HTTP struct {
		Port string `yaml:"port"`
	} `yaml:"http"`

	Saleor struct {
		APIURL    string `yaml:"apiUrl"`
		Token     string `yaml:"token"`
		ChannelID string `yaml:"channelId"`
		ChannelSlug string `yaml:"channelSlug"`
	} `yaml:"saleor"`

	Telegram struct {
		BotToken string `yaml:"botToken"`
	} `yaml:"telegram"`

	TMA struct {
		RestaurantRootCategoryID string `yaml:"restaurantRootCategoryId"`
	} `yaml:"tma"`
}

func Load() (Config, error) {
	cfg := Config{}
	cfg.HTTP.Port = "8080"

	if path := os.Getenv("CONFIG_PATH"); path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return Config{}, fmt.Errorf("read config: %w", err)
		}
		if err := yaml.Unmarshal(b, &cfg); err != nil {
			return Config{}, fmt.Errorf("parse config yaml: %w", err)
		}
	}

	// Environment overrides (expected in deploy).
	if v := os.Getenv("PORT"); v != "" {
		cfg.HTTP.Port = v
	}
	if v := os.Getenv("SALEOR_API_URL"); v != "" {
		cfg.Saleor.APIURL = v
	}
	if v := os.Getenv("SALEOR_TOKEN"); v != "" {
		cfg.Saleor.Token = v
	}
	if v := os.Getenv("SALEOR_CHANNEL_ID"); v != "" {
		cfg.Saleor.ChannelID = v
	}
	if v := os.Getenv("SALEOR_CHANNEL_SLUG"); v != "" {
		cfg.Saleor.ChannelSlug = v
	}
	if v := os.Getenv("TELEGRAM_BOT_TOKEN"); v != "" {
		cfg.Telegram.BotToken = v
	}
	if v := os.Getenv("TMA_RESTAURANT_ROOT_CATEGORY_ID"); v != "" {
		cfg.TMA.RestaurantRootCategoryID = v
	}

	if cfg.Saleor.APIURL == "" {
		return Config{}, errors.New("missing Saleor API url (set saleor.apiUrl in config or SALEOR_API_URL)")
	}
	if cfg.Saleor.Token == "" {
		return Config{}, errors.New("missing Saleor token (set saleor.token in config or SALEOR_TOKEN)")
	}
	if cfg.Saleor.ChannelID == "" {
		return Config{}, errors.New("missing Saleor channel id (set saleor.channelId in config or SALEOR_CHANNEL_ID)")
	}
	if cfg.Saleor.ChannelSlug == "" {
		return Config{}, errors.New("missing Saleor channel slug (set saleor.channelSlug in config or SALEOR_CHANNEL_SLUG)")
	}
	if cfg.Telegram.BotToken == "" {
		return Config{}, errors.New("missing Telegram bot token (set telegram.botToken in config or TELEGRAM_BOT_TOKEN)")
	}

	return cfg, nil
}

