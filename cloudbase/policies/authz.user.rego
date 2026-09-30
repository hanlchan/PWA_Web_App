package authz.user

default allow := false

# Public access is limited to the CloudBase shadow domain used by the Next.js
# HTTP function. Event functions remain inaccessible through other gateway hosts.
allow if {
  input.cloudbase.resource_type == "functions"
  input.request.host == "pwa-web-app-d8gpuhess695771e6-1493086646.ap-shanghai.app.tcloudbase.com"
}
