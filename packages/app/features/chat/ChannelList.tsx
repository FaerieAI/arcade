import { Channel } from 'app/stores/chat'
import { useRef } from 'react'
import { Separator, Stack, Text } from '@my/ui'
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list'
import { ChannelPreview } from './ChannelPreview'
import { useChannels } from './useChannels'

export const ChannelList = () => {
  const channels = useChannels()
  const flashListRef = useRef<FlashList<Channel>>(null)

  const renderItem = ({ index }: ListRenderItemInfo<Channel>) => {
    const channel = channels[index]
    if (!channel) return <></>

    return (
      <ChannelPreview
        channel={channel}
        onPress={() =>
          console.log(
            `Clicked channel: ${channel.metadata.name} with picture: ${channel.metadata.picture}, ${channel.metadata.about}}`
          )
        }
      />
    )
  }

  return (
    <FlashList
      ref={flashListRef}
      renderItem={renderItem}
      estimatedItemSize={150}
      data={channels}
      ListHeaderComponent={
        <Stack backgroundColor="$haiti" pt="$10">
          <Text textAlign="center" color="$moonRaker" fontSize={24} mb="$5" fontWeight="bold">
            Channels
          </Text>
          <Separator borderBottomColor="$portGore" borderColor="$portGore" />
        </Stack>
      }
      ItemSeparatorComponent={() => <Separator borderColor="$portGore" borderWidth={0.5} mb={-1} />}
    />
  )
}