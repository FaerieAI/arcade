import React, { FC } from "react"
import { observer } from "mobx-react-lite"
import { View, ViewStyle } from "react-native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { AppStackScreenProps } from "app/navigators"
import { ScreenWithSidebar, ChannelItem, Text } from "app/components"
import { spacing } from "app/theme"
import { FlashList } from "@shopify/flash-list"
import { useStores } from "app/models"

interface HomeMessagesScreenProps
  extends NativeStackScreenProps<AppStackScreenProps<"HomeMessages">> {}

export const HomeMessagesScreen: FC<HomeMessagesScreenProps> = observer(
  function HomeMessagesScreen() {
    const { userStore } = useStores()

    return (
      <ScreenWithSidebar title={"Messages"}>
        <View style={$main}>
          <View style={$messsages}>
            <FlashList
              data={userStore.channels.slice()}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ChannelItem id={item.id} privkey={item.privkey} />}
              ListEmptyComponent={
                <View style={$emptyState}>
                  <Text text="No channel..." />
                </View>
              }
              estimatedItemSize={50}
            />
          </View>
        </View>
      </ScreenWithSidebar>
    )
  },
)

const $main: ViewStyle = {
  flex: 1,
  flexDirection: "column",
  gap: spacing.small,
  width: "100%",
  height: "100%",
  paddingHorizontal: spacing.medium,
}

const $messsages: ViewStyle = {
  flex: 1,
  paddingVertical: spacing.extraSmall,
}

const $emptyState: ViewStyle = {
  alignSelf: "center",
  paddingVertical: spacing.medium,
}
