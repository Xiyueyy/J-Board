package probe

import (
	"regexp"
	"strings"
)

var asnPattern = regexp.MustCompile(`(?i)(?:^|\b)AS?\s*(\d{2,10})(?:\b|$)`)

func normalizeRouteText(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeASN(value string) string {
	text := normalizeRouteText(value)
	if text == "" {
		return ""
	}
	match := asnPattern.FindStringSubmatch(text)
	if len(match) > 1 {
		return match[1]
	}
	for _, r := range text {
		if r < '0' || r > '9' {
			return ""
		}
	}
	return text
}

func hasASN(asns map[string]struct{}, values ...string) bool {
	for _, value := range values {
		if _, ok := asns[value]; ok {
			return true
		}
	}
	return false
}

func hasText(combined string, values ...string) bool {
	for _, value := range values {
		if strings.Contains(combined, value) {
			return true
		}
	}
	return false
}

func hasIPPrefix(ips []string, prefixes ...string) bool {
	for _, ip := range ips {
		for _, prefix := range prefixes {
			if strings.HasPrefix(ip, prefix) {
				return true
			}
		}
	}
	return false
}

func detectSummary(hops []hopDetail) string {
	var texts []string
	var ips []string
	asns := make(map[string]struct{})

	for _, hop := range hops {
		if hop.IP != "" && hop.IP != "*" {
			ips = append(ips, hop.IP)
		}
		parts := []string{hop.Geo, hop.ASN, hop.Owner, hop.ISP}
		text := normalizeRouteText(strings.Join(parts, " "))
		texts = append(texts, text)

		if asn := normalizeASN(hop.ASN); asn != "" {
			asns[asn] = struct{}{}
		}
		for _, match := range asnPattern.FindAllStringSubmatch(text, -1) {
			if len(match) > 1 {
				asns[match[1]] = struct{}{}
			}
		}
	}

	combined := strings.Join(texts, " ")
	cn2Evidence := hasASN(asns, "4809") ||
		hasIPPrefix(ips, "59.43.") ||
		hasText(combined, "CN2", "CTGNET", "CHINANET NEXT CARRYING NETWORK", "CHINA TELECOM GLOBAL")
	cn2GIAText := hasText(combined, "CN2 GIA", "CN2GIA", "GIA", "GLOBAL INTERNET ACCESS")
	ordinaryTelecomHops := 0
	for _, text := range texts {
		if strings.Contains(text, "AS4134") ||
			strings.Contains(text, "CHINANET BACKBONE") ||
			strings.Contains(text, "CHINANET 163") ||
			strings.Contains(text, "163骨干") {
			ordinaryTelecomHops++
		}
	}
	for _, ip := range ips {
		if strings.HasPrefix(ip, "202.97.") {
			ordinaryTelecomHops++
		}
	}

	if cn2Evidence {
		if cn2GIAText || ordinaryTelecomHops <= 1 {
			return "CN2 GIA"
		}
		return "CN2 GT"
	}

	if hasASN(asns, "9929", "10099") || hasText(combined, "CUII", "A网", "AS9929") {
		return "AS9929"
	}
	if hasText(combined, "CMIN2") || hasASN(asns, "58807", "58809", "58813", "58819", "59807") {
		return "CMIN2"
	}
	if hasText(combined, "CMI") || hasASN(asns, "58453") {
		return "CMI"
	}
	if hasASN(asns, "4837") || hasText(combined, "AS4837") {
		return "AS4837"
	}

	return "普通线路"
}
