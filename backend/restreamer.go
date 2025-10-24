package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// --- Restreamer API Structs ---

type RestreamerLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RestreamerLoginResponse struct {
	Token string `json:"token"`
}

// A simplified struct for a process. The actual one is much more complex.
// We only care about the id, name, and the output url for now.
type RestreamerProcess struct {
    ID   string `json:"id"`
    Name string `json:"name"`
    Output []struct {
        URL string `json:"url"`
    } `json:"output"`
}

type AddRestreamerProcessRequest struct {
    Name string `json:"name"`
    Input []struct {
        Type string `json:"type"`
        URL  string `json:"url"`
    } `json:"input"`
    Output []struct {
        Type string `json:"type"`
        URL  string `json:"url"`
    } `json:"output"`
}


// --- Restreamer Client ---

type RestreamerClient struct {
	BaseURL  string
	Username string
	Password string
	Token    string
	Client   *http.Client
}

func NewRestreamerClient(baseURL, username, password string) (*RestreamerClient, error) {
	c := &RestreamerClient{
		BaseURL:  baseURL,
		Username: username,
		Password: password,
		Client:   &http.Client{},
	}
	err := c.Login()
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (c *RestreamerClient) Login() error {
	loginReq := RestreamerLoginRequest{
		Username: c.Username,
		Password: c.Password,
	}
	jsonBody, err := json.Marshal(loginReq)
	if err != nil {
		return err
	}

	resp, err := c.Client.Post(c.BaseURL+"/api/login", "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
        bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("restreamer login failed with status: %s, body: %s", resp.Status, string(bodyBytes))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var loginResp RestreamerLoginResponse
	if err := json.Unmarshal(body, &loginResp); err != nil {
		return err
	}

	c.Token = loginResp.Token
	return nil
}

func (c *RestreamerClient) GetDestinations() ([]RestreamerProcess, error) {
    req, err := http.NewRequest("GET", c.BaseURL+"/api/v3/process", nil)
    if err != nil {
        return nil, err
    }
    req.Header.Set("Authorization", "Bearer "+c.Token)

    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("get destinations failed with status: %s", resp.Status)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var processes []RestreamerProcess
    if err := json.Unmarshal(body, &processes); err != nil {
        return nil, err
    }

    return processes, nil
}

func (c *RestreamerClient) DeleteDestination(id string) error {
    req, err := http.NewRequest("DELETE", c.BaseURL+"/api/v3/process/"+id, nil)
    if err != nil {
        return err
    }
    req.Header.Set("Authorization", "Bearer "+c.Token)

    resp, err := c.Client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("delete destination failed with status: %s", resp.Status)
    }

    return nil
}

func (c *RestreamerClient) AddDestination(name, rtmpURL string) (*RestreamerProcess, error) {
    addReq := AddRestreamerProcessRequest{
        Name: name,
        Input: []struct {
            Type string `json:"type"`
            URL  string `json:"url"`
        }{{
            Type: "rtmp",
            URL:  "rtmp://restreamer:1935/live/stream",
        }},
        Output: []struct {
            Type string `json:"type"`
            URL  string `json:"url"`
        }{{
            Type: "rtmp",
            URL:  rtmpURL,
        }},
    }

    jsonBody, err := json.Marshal(addReq)
    if err != nil {
        return nil, err
    }

    req, err := http.NewRequest("POST", c.BaseURL+"/api/v3/process", bytes.NewBuffer(jsonBody))
    if err != nil {
        return nil, err
    }
    req.Header.Set("Authorization", "Bearer "+c.Token)
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusCreated {
        bodyBytes, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("add destination failed with status: %s, body: %s", resp.Status, string(bodyBytes))
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var newProcess RestreamerProcess
    if err := json.Unmarshal(body, &newProcess); err != nil {
        return nil, err
    }

    return &newProcess, nil
}
