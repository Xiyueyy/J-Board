package probe

import "testing"

func TestDetectSummaryCN2GIAFromAS4809And59_43(t *testing.T) {
	hops := []hopDetail{
		{Hop: 1, IP: "*"},
		{Hop: 2, IP: "59.43.246.237", ASN: "AS4809", Geo: "中国 上海 China Telecom CN2"},
		{Hop: 3, IP: "219.141.136.12", ASN: "AS4134", Geo: "中国 北京 电信"},
	}
	if got := detectSummary(hops); got != "CN2 GIA" {
		t.Fatalf("detectSummary() = %q, want CN2 GIA", got)
	}
}

func TestDetectSummaryCN2GTWhenCN2FallsBackTo163(t *testing.T) {
	hops := []hopDetail{
		{Hop: 1, IP: "59.43.248.1", ASN: "AS4809", Geo: "CN2"},
		{Hop: 2, IP: "202.97.12.1", ASN: "AS4134", Geo: "CHINANET BACKBONE"},
		{Hop: 3, IP: "202.97.18.1", ASN: "AS4134", Geo: "CHINANET BACKBONE"},
	}
	if got := detectSummary(hops); got != "CN2 GT" {
		t.Fatalf("detectSummary() = %q, want CN2 GT", got)
	}
}

func TestDetectSummaryCMIN2BeforeCMI(t *testing.T) {
	hops := []hopDetail{
		{Hop: 2, IP: "223.120.20.1", ASN: "AS58807", Geo: "CMIN2 China Mobile"},
		{Hop: 3, IP: "211.136.25.153", ASN: "AS9808", Geo: "CMI Mobile"},
	}
	if got := detectSummary(hops); got != "CMIN2" {
		t.Fatalf("detectSummary() = %q, want CMIN2", got)
	}
}
