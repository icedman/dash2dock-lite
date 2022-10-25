## media playing

```js
media = Main.panel._centerBox.first_child.child._delegate._messageList._scrollView.last_child.get_children()[0]

v = media._players.entries(0)
v.next().value
```

## message list

```js
calendar = Main.panel._centerBox.first_child.child._delegate._messageList._scrollView.last_child.get_children()[1]

calendar._messages;
calendar.first_child.get_children()[0]

// messageList.js
calendar._messages[1]._iconBin
calendar._messages[1].titleLabel
calendar._messages[1].bodyLabel
calendar._messages[1].notification
calendar._messages[0].notification.source._appId

const MessageTray = imports.ui.messageTray;
// LOW, NORMAL, HIGH, CRITICAL
// MessageTray.Urgency.CRITICAL

calendar._messages[1].notification.urgency
calendar._messages[1]._iconBin.first_child.icon_name

```