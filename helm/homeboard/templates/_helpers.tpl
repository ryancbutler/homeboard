{{- define "homeboard.name" -}}homeboard{{- end -}}
{{- define "homeboard.fullname" -}}{{ .Release.Name }}-{{ include "homeboard.name" . }}{{- end -}}
