package handlers

import (
	"errors"
	"testing"

	"stream-platform/backend/internal/models"
)

func TestValidateDestinationInput(t *testing.T) {
	cases := []struct {
		name    string
		in      models.DestinationInput
		wantErr bool
		// wantName, boş bırakılırsa kontrol edilmez
		wantName string
	}{
		{"geçerli rtmp", models.DestinationInput{Platform: "YouTube", RTMPUrl: "rtmp://a.rtmp.youtube.com/live2", StreamKey: "k"}, false, "YouTube"},
		{"geçerli rtmps", models.DestinationInput{Platform: "Facebook", RTMPUrl: "rtmps://live.fb.com/rtmp", StreamKey: "k"}, false, "Facebook"},
		{"boş platform", models.DestinationInput{RTMPUrl: "rtmp://a", StreamKey: "k"}, true, ""},
		{"http reddedilir", models.DestinationInput{Platform: "X", RTMPUrl: "http://evil", StreamKey: "k"}, true, ""},
		{"şemasız url reddedilir", models.DestinationInput{Platform: "X", RTMPUrl: "a.rtmp.youtube.com", StreamKey: "k"}, true, ""},
		{"boş stream key reddedilir", models.DestinationInput{Platform: "X", RTMPUrl: "rtmp://a", StreamKey: ""}, true, ""},
		{"boşluklu stream key reddedilir", models.DestinationInput{Platform: "X", RTMPUrl: "rtmp://a", StreamKey: "   "}, true, ""},
		{"ad boşsa platforma düşer", models.DestinationInput{Platform: "Twitch", RTMPUrl: "rtmp://a", StreamKey: "k"}, false, "Twitch"},
		{"baştaki/sondaki boşluklar kırpılır", models.DestinationInput{Platform: "  Kick  ", RTMPUrl: "  rtmp://a  ", StreamKey: "  k  "}, false, "Kick"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			in := c.in
			msg := validateDestinationInput(&in)
			if c.wantErr && msg == "" {
				t.Fatalf("hata bekleniyordu, geçti")
			}
			if !c.wantErr && msg != "" {
				t.Fatalf("geçmesi bekleniyordu, hata: %q", msg)
			}
			if !c.wantErr && c.wantName != "" && in.Name != c.wantName {
				t.Fatalf("ad %q bekleniyordu, gelen %q", c.wantName, in.Name)
			}
			if !c.wantErr && (in.RTMPUrl != trimSpace(in.RTMPUrl) || in.StreamKey != trimSpace(in.StreamKey)) {
				t.Fatalf("url/key kırpılmamış: %q / %q", in.RTMPUrl, in.StreamKey)
			}
		})
	}
}

// trimSpace, strings.TrimSpace ile aynı; testi bağımsız tutmak için küçük yardımcı.
func trimSpace(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}

func TestEgressGone(t *testing.T) {
	gone := []string{
		"twirp error not_found: egress does not exist",
		"rpc error: egress EG_x not found",
		"failed_precondition: already stopped",
		"egress cannot be stopped",
	}
	for _, m := range gone {
		if !egressGone(errors.New(m)) {
			t.Errorf("egressGone(%q) = false, true bekleniyordu", m)
		}
	}
	notGone := []string{
		"twirp error unavailable: no response from servers",
		"context deadline exceeded",
		"connection refused",
	}
	for _, m := range notGone {
		if egressGone(errors.New(m)) {
			t.Errorf("egressGone(%q) = true, false bekleniyordu", m)
		}
	}
}

func TestCleanDisplayName(t *testing.T) {
	if got := cleanDisplayName("  Ali Karabay  "); got != "Ali Karabay" {
		t.Errorf("kırpma hatalı: %q", got)
	}
	if got := cleanDisplayName("   "); got != "" {
		t.Errorf("boşluk boş dönmeli: %q", got)
	}
	long := ""
	for i := 0; i < 60; i++ {
		long += "x"
	}
	if got := cleanDisplayName(long); len([]rune(got)) != 40 {
		t.Errorf("uzun ad 40'a kırpılmalı, uzunluk %d", len([]rune(got)))
	}
	// Çok baytlı karakterler bayt değil rune sayısına göre kesilmeli
	tr := ""
	for i := 0; i < 60; i++ {
		tr += "ş"
	}
	if got := cleanDisplayName(tr); len([]rune(got)) != 40 {
		t.Errorf("çok baytlı ad 40 rune'a kırpılmalı, uzunluk %d", len([]rune(got)))
	}
}
