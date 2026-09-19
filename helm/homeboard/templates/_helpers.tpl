{{- define "homeboard.name" -}}homeboard{{- end -}}
{{- define "homeboard.fullname" -}}{{ .Release.Name }}-{{ include "homeboard.name" . }}{{- end -}}
{{- define "homeboard.databaseUrl" -}}
{{- if .Values.config.databaseUrl -}}
{{ .Values.config.databaseUrl }}
{{- else if .Values.secrets.databaseUrlKey -}}
{{- "" -}}
{{- else -}}
file:/data/homeboard.db
{{- end -}}
{{- end -}}
{{- define "homeboard.usesSecretDatabaseUrl" -}}{{- if and (not .Values.config.databaseUrl) .Values.secrets.databaseUrlKey -}}true{{- end -}}{{- end -}}
{{- define "homeboard.usesSqlite" -}}{{- if and (not .Values.config.databaseUrl) (not .Values.secrets.databaseUrlKey) .Values.sqlite.persistence.enabled -}}true{{- end -}}{{- end -}}
