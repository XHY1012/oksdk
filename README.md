# OK SDK (JavaScript SDK)
# Неофициальная версия ok-sdk-js

# Дисклеймер

Я не присваиваю себе авторства над кодом который используется в качестве основы для данного пакета, основной целью данного проекта является возможность работы с *OKSDK*  без необходимости создания оберток для работы с UMD модулем. В первую очередь моя работа нацелена на различные системы сборки ( *webpack*, *rollup* и т.д ) которые по умолчанию работают с *es2015* и не имеют поддержки устаревших модулей ( AMD, UMD и т.д ).

## Использование

Предназначено для использование в качестве es2015 модуля, без системы сборки *РАБОТАТЬ НЕБУДЕТ*.

## Примеры

## На данный момент примеры в репозитории рассчитаны на работу с oksdk.js и не являются актуальными для данного пакета ##

+ *helloworld* - Simple Hello World, %user% application skeleton
+ *helloworld-norefresh* - Advanced Hello World, proceedes OAUTH authorization via popup window and sending state back via javascript postmessage, so leading to no redirect on the main page
+ *payment* - Open and process a payment
* *send-simple* - Sending a simple notification to the current user (via non-session method notifications.sendSimple)
* *viral* - Viral widgets
  * post media topic (WidgetMediatopicPost)
  * post media topic (WidgetMediatopicPost) with custom user-provided image via AJAX (requires PHOTO_CONTENT permission)
  * suggest/invite friends to the app (WidgetSuggest / WidgetInvite)

## Требования к приложению

Приложение которое регистрируется на платформе *OK* должно иметь:

### Мобильную / Веб версию

1. Target platform checked (like MOBILE_HTML)
2. A VALUABLE_ACCESS permission being checked or requested

### External / OAUTH game (also applicable for native Android/iOS)

1. EXTERNAL platform checked
2. Client OAUTH checkbox checked
3. A VALUABLE_ACCESS permission being checked or requested
