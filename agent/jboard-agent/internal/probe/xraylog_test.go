package probe

import "testing"

func TestParseXrayAccessLine(t *testing.T) {
	line := "2026/04/29 10:11:12 203.0.113.9:51820 accepted tcp:example.com:443 [proxy-in >> freedom] email: user@example.com-cabc1234"
	got, ok := parseXrayAccessLine(line)
	if !ok {
		t.Fatal("parseXrayAccessLine() failed")
	}
	if got.SourceIP != "203.0.113.9" {
		t.Fatalf("SourceIP = %q", got.SourceIP)
	}
	if got.ClientEmail != "user@example.com-cabc1234" {
		t.Fatalf("ClientEmail = %q", got.ClientEmail)
	}
	if got.InboundTag != "proxy-in" {
		t.Fatalf("InboundTag = %q", got.InboundTag)
	}
	if got.Network != "tcp" || got.TargetHost != "example.com" || got.TargetPort != 443 {
		t.Fatalf("target = %s %s:%d", got.Network, got.TargetHost, got.TargetPort)
	}
}

func TestParseXrayAccessLineWithTransportPrefixedSource(t *testing.T) {
	line := "2026/04/29 10:11:12 tcp:203.0.113.9:51820 accepted tcp:example.com:443 [proxy] email: user@example.com-cabc1234"
	got, ok := parseXrayAccessLine(line)
	if !ok {
		t.Fatal("parseXrayAccessLine() failed")
	}
	if got.SourceIP != "203.0.113.9" {
		t.Fatalf("SourceIP = %q", got.SourceIP)
	}
}

func TestParseXrayAccessLineWithIPv6Source(t *testing.T) {
	line := "2026/04/29 10:11:12 tcp:[2001:db8::1]:51820 accepted tcp:example.com:443 [proxy] email: user@example.com-cabc1234"
	got, ok := parseXrayAccessLine(line)
	if !ok {
		t.Fatal("parseXrayAccessLine() failed")
	}
	if got.SourceIP != "2001:db8::1" {
		t.Fatalf("SourceIP = %q", got.SourceIP)
	}
}

func TestAggregateXrayAccessLines(t *testing.T) {
	lines := []string{
		"2026/04/29 10:11:12 203.0.113.9:51820 accepted tcp:example.com:443 [proxy] email: user@example.com-cabc1234",
		"2026/04/29 10:11:13 203.0.113.9:51821 accepted tcp:openai.com:443 [proxy] email: user@example.com-cabc1234",
		"2026/04/29 10:11:14 198.51.100.2:51821 accepted udp:1.1.1.1:53 [proxy] email: user@example.com-cabc1234",
	}
	events := aggregateXrayAccessLines(lines)
	if len(events) != 2 {
		t.Fatalf("len(events) = %d, want 2", len(events))
	}
	if events[0].ConnectionCount != 2 || events[0].UniqueTargetCount != 2 {
		t.Fatalf("first aggregate = %+v", events[0])
	}
	if events[1].Network != "udp" || events[1].TargetPort != 53 {
		t.Fatalf("second aggregate = %+v", events[1])
	}
}
