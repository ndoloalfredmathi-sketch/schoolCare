import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Student } from "../types/models";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#0a0a0a",
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 46,
  },
  banner: {
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  bannerTitle: { color: "#fafafa", fontSize: 15, fontWeight: 700 },
  bannerSub: { color: "#9ca3af", fontSize: 8.5, marginTop: 3 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    fontSize: 8.5,
    color: "#6b7280",
  },
  filters: { marginTop: 4, fontSize: 8.5, color: "#6b7280" },
  headRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    marginTop: 14,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  headText: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#374151",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  cell: { fontSize: 9.5 },
  cellStrong: { fontSize: 9.5, fontWeight: 700 },
  cellMuted: { fontSize: 9.5, color: "#6b7280" },
  cellMono: { fontSize: 9, color: "#6b7280" },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9ca3af",
  },
  kicker: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "#6b7280",
    marginTop: 26,
  },
  name: { fontSize: 26, fontWeight: 700, marginTop: 6 },
  matricule: { fontSize: 11, color: "#6b7280", marginTop: 4 },
  statusLine: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: 700,
  },
  statusActive: { backgroundColor: "#d1fae5", color: "#065f46" },
  statusInactive: { backgroundColor: "#f3f4f6", color: "#4b5563" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  field: {
    width: "50%",
    paddingVertical: 14,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  fieldLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    color: "#9ca3af",
  },
  fieldValue: { fontSize: 12, marginTop: 5 },
});

const COLUMNS = [
  { label: "Matricule", width: 82 },
  { label: "Nom", width: 148 },
  { label: "Classe", width: 60 },
  { label: "Sexe", width: 66 },
  { label: "Naissance", width: 76 },
  { label: "Statut", width: 60 },
];

const today = () =>
  new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const genderLabel = (gender: Student["gender"]) =>
  gender === "F" ? "Féminin" : "Masculin";

const statusLabel = (status: Student["status"]) =>
  status === "active" ? "Actif" : "Sorti";

export function StudentListDocument({
  students,
  filters,
}: {
  students: Student[];
  filters: string;
}) {
  return (
    <Document title="Liste des élèves" author="SchoolCare">
      <Page size="A4" style={styles.page}>
        <View style={styles.banner} fixed>
          <Text style={styles.bannerTitle}>SchoolCare</Text>
          <Text style={styles.bannerSub}>Liste des élèves</Text>
        </View>

        <View style={styles.metaRow}>
          <Text>{students.length} élève(s)</Text>
          <Text>Édité le {today()}</Text>
        </View>
        {filters ? <Text style={styles.filters}>Filtres : {filters}</Text> : null}

        <View style={styles.headRow} fixed>
          {COLUMNS.map((column) => (
            <Text key={column.label} style={[styles.headText, { width: column.width }]}>
              {column.label}
            </Text>
          ))}
        </View>

        {students.map((student) => (
          <View key={student.id} style={styles.row} wrap={false}>
            <Text style={[styles.cellMono, { width: COLUMNS[0].width }]}>
              {student.matricule}
            </Text>
            <Text style={[styles.cellStrong, { width: COLUMNS[1].width }]}>
              {student.lastName.toUpperCase()} {student.firstName}
            </Text>
            <Text style={[styles.cell, { width: COLUMNS[2].width }]}>
              {student.className ?? "—"}
            </Text>
            <Text style={[styles.cell, { width: COLUMNS[3].width }]}>
              {genderLabel(student.gender)}
            </Text>
            <Text style={[styles.cellMuted, { width: COLUMNS[4].width }]}>
              {student.birthDate ?? "—"}
            </Text>
            <Text style={[styles.cell, { width: COLUMNS[5].width }]}>
              {statusLabel(student.status)}
            </Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>SchoolCare — Document généré automatiquement</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function StudentProfileDocument({ student }: { student: Student }) {
  return (
    <Document title={`Fiche ${student.matricule}`} author="SchoolCare">
      <Page size="A4" style={styles.page}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>SchoolCare</Text>
          <Text style={styles.bannerSub}>Fiche individuelle de l'élève</Text>
        </View>

        <Text style={styles.kicker}>Élève</Text>
        <Text style={styles.name}>
          {student.lastName.toUpperCase()} {student.firstName}
        </Text>
        <Text style={styles.matricule}>{student.matricule}</Text>

        <View style={styles.statusLine}>
          <Text
            style={[
              styles.statusBadge,
              student.status === "active" ? styles.statusActive : styles.statusInactive,
            ]}
          >
            {statusLabel(student.status)}
          </Text>
        </View>

        <View style={styles.grid}>
          <Field label="Classe" value={student.className ?? "—"} />
          <Field label="Sexe" value={genderLabel(student.gender)} />
          <Field label="Date de naissance" value={student.birthDate ?? "—"} />
          <Field label="Statut" value={statusLabel(student.status)} />
          <Field label="Matricule" value={student.matricule} />
          <Field label="Identifiant" value={String(student.id)} />
        </View>

        <View style={styles.footer} fixed>
          <Text>SchoolCare — Document généré automatiquement</Text>
          <Text>Édité le {today()}</Text>
        </View>
      </Page>
    </Document>
  );
}
