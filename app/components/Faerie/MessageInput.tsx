import { useNpub } from "app/hooks/useNpub"
import { useSendMessage } from "app/hooks/useSendMessage"
import { colors, spacing } from "app/theme"
import { ArrowUpIcon } from "lucide-react-native"
import React, { useRef, useState } from "react"
import { Alert, TextInput, View, ViewStyle } from "react-native"
import { Button } from "../Button"
import { TextField } from "../TextField"

export const MessageInput = ({ conversationId, conversationType }) => {
  const { mutate } = useSendMessage()
  const [text, setText] = useState("")
  const npub = useNpub()

  const inputBoxRef = useRef<TextInput | null>(null)
  const submitInput = (enteredText) => {
    if (!npub) {
      Alert.alert("Couldn't find your user ID - try reopening the app")
      return
    }
    if (!enteredText || enteredText.length < 1) {
      Alert.alert("Message too short", "What is that, a message for ants?")
      return
    }
    setText("")
    inputBoxRef.current?.clear()
    inputBoxRef.current?.blur()

    const textToSend = enteredText ?? text

    mutate({ message: textToSend, conversationId, conversationType, npub })
  }
  return (
    <View>
      <TextField
        ref={inputBoxRef}
        placeholder={
          conversationType === "dialogue" ? `Write your message here` : "Ask your question here"
        }
        placeholderTextColor={colors.palette.cyan500}
        style={$input}
        inputWrapperStyle={$inputWrapper}
        onChangeText={(text: string) => setText(text)}
        autoCapitalize="none"
        autoCorrect={true}
        autoComplete="name"
        RightAccessory={() => (
          <Button
            onPress={() => submitInput(text)}
            LeftAccessory={() => (
              <ArrowUpIcon width={20} height={20} style={{ color: colors.palette.cyan100 }} />
            )}
            style={$sendButton}
          />
        )}
      />
    </View>
  )
}

const $inputWrapper: ViewStyle = {
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: colors.palette.overlay20,
  borderWidth: 0,
  borderRadius: 0,
  paddingVertical: spacing.extraSmall,
  paddingHorizontal: spacing.large,
  gap: spacing.small,
}

const $input: ViewStyle = {
  flexGrow: 1,
  flexShrink: 1,
  height: 40,
  borderWidth: 0,
  borderRadius: 100,
  backgroundColor: colors.palette.overlay20,
  paddingHorizontal: spacing.medium,
  paddingVertical: 0,
  marginVertical: 0,
  marginHorizontal: 0,
}

export const $sendButton: ViewStyle = {
  width: 40,
  height: 40,
  minHeight: 40,
  backgroundColor: colors.palette.cyan600,
  borderRadius: 100,
  borderWidth: 0,
  flexShrink: 0,
  marginRight: spacing.small,
}
