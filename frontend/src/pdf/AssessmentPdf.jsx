// The branded PDF export (Phase 4.2): a @react-pdf/renderer document mirroring
// AssessmentResult's reading order — verdict → why → what applies → what could
// go wrong → what to do → caveat.
//
// @react-pdf renders outside the browser, so no CSS variables and no Tailwind:
// every colour here comes from the RISK_HEX / UI_HEX mirrors in constants.js
// (see the "risk colours are a contract" note in theme.css).
//
// This module is only ever loaded through a dynamic import (see
// downloadAssessmentPdf.js) so the renderer never weighs down the main bundle.
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { RISK_FALLBACK, RISK_HEX, UI_HEX } from "../constants.js";
import { formatDateTime } from "../format.js";

const APPLICABILITY_HEX = {
  applies: { bg: UI_HEX.accentSoft, fg: UI_HEX.accent },
  "partially applies": {
    bg: RISK_HEX.medium.bg,
    fg: RISK_HEX.medium.fg,
  },
  "does not apply": { bg: UI_HEX.sunken, fg: UI_HEX.muted },
};

const styles = StyleSheet.create({
  // No lineHeight here, deliberately: a page-level (or inherited) lineHeight
  // silently stops fixed render-prop Texts — the page numbers — from ever
  // painting in @react-pdf 4.5.1. Multi-line text styles carry their own.
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: UI_HEX.ink,
    paddingTop: 48,
    paddingHorizontal: 48,
    paddingBottom: 64,
  },
  brand: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: UI_HEX.accent,
    fontFamily: "Helvetica-Bold",
  },
  // Large type needs its own lineHeight: the inherited value is computed
  // against the page's 9.5pt base, which would give these a line box smaller
  // than their glyphs and let the next line overlap them.
  title: {
    fontSize: 19,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.25,
    marginTop: 4,
  },
  meta: { fontSize: 9, color: UI_HEX.muted, marginTop: 3 },

  verdict: { borderRadius: 8, padding: 16, marginTop: 14 },
  verdictEyebrow: {
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    opacity: 0.85,
  },
  verdictLevel: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    textTransform: "capitalize",
    lineHeight: 1.25,
    marginTop: 2,
  },
  verdictSummary: { marginTop: 6, lineHeight: 1.25 },

  glance: { fontSize: 8.5, color: UI_HEX.muted, marginTop: 10 },

  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 8,
  },

  card: {
    borderWidth: 1,
    borderColor: UI_HEX.line,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", flexShrink: 1 },
  cardSubtitle: { color: UI_HEX.inkSoft, marginTop: 2, lineHeight: 1.25 },
  body: { color: UI_HEX.inkSoft, marginTop: 6, lineHeight: 1.25 },

  pill: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "capitalize",
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },

  eyebrow: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    color: UI_HEX.muted,
    marginTop: 8,
    marginBottom: 3,
  },
  bulletRow: { flexDirection: "row", marginBottom: 2 },
  bulletMark: { width: 12, color: UI_HEX.lineStrong },
  bulletText: { flex: 1, color: UI_HEX.inkSoft, lineHeight: 1.25 },

  levels: { flexDirection: "row", gap: 16 },
  levelValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "capitalize",
    marginTop: 1,
  },

  factsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: UI_HEX.line,
    marginTop: 10,
    paddingTop: 2,
  },
  fact: { width: "33%", paddingRight: 10, marginTop: 6 },
  factValue: { textTransform: "capitalize", marginTop: 1 },

  disclaimer: {
    marginTop: 16,
    borderLeftWidth: 2,
    borderLeftColor: UI_HEX.lineStrong,
    paddingLeft: 10,
    color: UI_HEX.muted,
    fontFamily: "Helvetica-Oblique",
    lineHeight: 1.25,
  },

  // Two absolutely-positioned fixed Texts, not a wrapping View — a fixed View
  // sized by left+right constraints silently fails to paint in @react-pdf 4.
  footerLeft: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 140,
    fontSize: 7.5,
    color: UI_HEX.muted,
  },
  // Like the left text but spanning the full line: a render-prop Text with no
  // horizontal span never paints, so give it both edges and right-align.
  footerRight: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 7.5,
    color: UI_HEX.muted,
    textAlign: "right",
  },
});

function Pill({ text, colors }) {
  return (
    <Text
      style={[styles.pill, { backgroundColor: colors.bg, color: colors.fg }]}
    >
      {text}
    </Text>
  );
}

function Bullets({ items }) {
  return items.map((item, i) => (
    <View key={i} style={styles.bulletRow} wrap={false}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ));
}

function Level({ label, level }) {
  const hex = RISK_HEX[level] || RISK_HEX[RISK_FALLBACK];
  return (
    <View>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text style={[styles.levelValue, { color: hex.fg }]}>{level}</Text>
    </View>
  );
}

export default function AssessmentPdf({ record }) {
  const { result, input, project_name, created_at, version } = record;
  const riskHex =
    RISK_HEX[result.overall_risk_level] || RISK_HEX[RISK_FALLBACK];
  const generatedAt = formatDateTime(new Date().toISOString());

  const applying = result.frameworks.filter(
    (f) => f.applicability !== "does not apply",
  ).length;

  const facts = [
    ["Industry", input.industry],
    ["Deployment", input.deployment_context],
    ["Affects decisions about people", input.affects_decisions ? "Yes" : "No"],
    ["Data types", input.data_types.join(", ") || "—"],
    ["Geographic scope", input.geographic_scope.join(", ") || "—"],
  ];

  return (
    <Document
      title={`${project_name} — AI risk assessment`}
      author="AI Risk Screener"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.footerLeft} fixed>
          {project_name} — generated {generatedAt} by AI Risk Screener. Not
          legal advice.
        </Text>
        <Text
          style={styles.footerRight}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />

        <Text style={styles.brand}>AI Risk Screener</Text>
        <Text style={styles.title}>{project_name}</Text>
        <Text style={styles.meta}>
          Assessed {formatDateTime(created_at)}
          {version != null && ` · Version ${version}`}
        </Text>

        <View
          style={[
            styles.verdict,
            { backgroundColor: riskHex.bg, color: riskHex.fg },
          ]}
        >
          <Text style={styles.verdictEyebrow}>Overall risk level</Text>
          <Text style={styles.verdictLevel}>{result.overall_risk_level}</Text>
          <Text style={styles.verdictSummary}>{result.summary}</Text>
        </View>

        <Text style={styles.glance}>
          {applying} of {result.frameworks.length} frameworks apply ·{" "}
          {result.risks.length} {result.risks.length === 1 ? "risk" : "risks"}{" "}
          identified · {result.recommended_next_steps.length} recommended next{" "}
          {result.recommended_next_steps.length === 1 ? "step" : "steps"}
        </Text>

        <Text style={styles.sectionTitle}>Regulatory frameworks</Text>
        {result.frameworks.map((fw, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHeader} wrap={false} minPresenceAhead={70}>
              <Text style={styles.cardTitle}>{fw.name}</Text>
              <Pill
                text={fw.applicability}
                colors={
                  APPLICABILITY_HEX[fw.applicability] ||
                  APPLICABILITY_HEX["partially applies"]
                }
              />
            </View>
            <Text style={styles.cardSubtitle}>{fw.classification}</Text>
            <Text style={styles.body}>{fw.rationale}</Text>
            {fw.key_obligations?.length > 0 && (
              <>
                <Text style={styles.eyebrow}>Key obligations</Text>
                <Bullets items={fw.key_obligations} />
              </>
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Risks & mitigations</Text>
        {result.risks.map((risk, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHeader} wrap={false} minPresenceAhead={70}>
              <Text style={[styles.cardTitle, { textTransform: "capitalize" }]}>
                {risk.category}
              </Text>
              <View style={styles.levels}>
                <Level label="Severity" level={risk.severity} />
                <Level label="Likelihood" level={risk.likelihood} />
              </View>
            </View>
            <Text style={styles.body}>{risk.description}</Text>
            {risk.mitigations?.length > 0 && (
              <>
                <Text style={styles.eyebrow}>Mitigations</Text>
                <Bullets items={risk.mitigations} />
              </>
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Recommended next steps</Text>
        <View style={styles.card}>
          {result.recommended_next_steps.map((step, i) => (
            <View key={i} style={styles.bulletRow} wrap={false}>
              <Text style={[styles.bulletMark, { color: UI_HEX.accent }]}>
                {i + 1}.
              </Text>
              <Text style={styles.bulletText}>{step}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Use case as assessed</Text>
        <View style={styles.card}>
          <Text style={{ color: UI_HEX.inkSoft, lineHeight: 1.25 }}>
            {input.use_case_description}
          </Text>
          <View style={styles.factsRow}>
            {facts.map(([label, value]) => (
              <View key={label} style={styles.fact}>
                <Text style={[styles.eyebrow, { marginTop: 0 }]}>{label}</Text>
                <Text style={styles.factValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {result.disclaimer && (
          <Text style={styles.disclaimer}>{result.disclaimer}</Text>
        )}
      </Page>
    </Document>
  );
}
