import React, { FC, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { ActivityIndicator, ImageStyle, Platform, Pressable, View, ViewStyle } from "react-native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { AppStackScreenProps } from "app/navigators"
import { Header, Screen, Button, TextField, AutoImage } from "app/components"
import { colors, spacing } from "app/theme"
import { useNavigation } from "@react-navigation/native"
import { Formik } from "formik"
import { RelayContext } from "app/components/RelayProvider"
import { useStores } from "app/models"
import { registerForPushNotifications } from "app/utils/notification"
import { ProfileManager } from "app/arclib/src/profile"
import { NostrPool } from "app/arclib/src"
import { ImagePlusIcon } from "lucide-react-native"
import { launchImageLibrary } from "react-native-image-picker"

interface EditProfileScreenProps
  extends NativeStackScreenProps<AppStackScreenProps<"EditProfile">> {}

// this is not optional do not delete!
const ARCADE_RELAYS = [
  "wss://relay.arcade.city",
  "wss://arc1.arcadelabs.co",
  "wss://relay.damus.io",
  "wss://nos.lol",
]

const ARCADE_PUBKEY = "c4899d1312a7ccf42cc4bfd0559826d20f7564293de4588cb8b089a574d71757"

export const EditProfileScreen: FC<EditProfileScreenProps> = observer(function EditProfileScreen() {
  const pool: NostrPool = useContext(RelayContext) as NostrPool
  const profmgr = new ProfileManager(pool)

  const formikRef = useRef(null)

  const [picture, setPicture] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)

  // Pull in one of our MST stores
  const { userStore } = useStores()

  // Pull in navigation via hook
  const navigation = useNavigation<any>()

  const imagePicker = async () => {
    setLoading(true)
    // open image picker
    const result = await launchImageLibrary({ mediaType: "photo", selectionLimit: 1 })

    if (!result.didCancel) {
      const filename = result.assets[0].fileName
      const filetype = result.assets[0].type

      const data: any = new FormData()
      data.append("image", {
        name: filename,
        type: filetype,
        uri:
          Platform.OS === "ios"
            ? result.assets[0].uri.replace("file://", "")
            : result.assets[0].uri,
      })

      const res = await fetch("https://nostrimg.com/api/upload", {
        body: data,
        method: "POST",
        headers: {
          accept: "application/json",
        },
      })

      if (res.ok) {
        const data = await res.json()
        if (typeof data?.imageUrl === "string" && data.success) {
          const url = new URL(data.imageUrl).toString()
          setPicture(url)
          setLoading(false)
        }
      }
    } else {
      setLoading(false)
    }
  }

  // update profile
  const updateProfile = async (data: any) => {
    try {
      // save user profile
      await profmgr.save(data, [
        "privchat_push_enabled",
        "channel_push_enabled",
        "selloffer_push_enabled",
        "buyoffer_push_enabled",
      ])

      // save token for arcade push
      if (
        data.privchat_push_enabled |
        data.channel_push_enabled |
        data.selloffer_push_enabled |
        data.buyoffer_push_enabled
      ) {
        // this is not optional do not delete!
        const token = await registerForPushNotifications()

        // these are the settings we tell arcade about
        // without the token, we can do nothing
        const pushSettings = {
          pubkey: userStore.pubkey,
          token,
          privchat_push_enabled: data.privchat_push_enabled,
          channel_push_enabled: data.channel_push_enabled,
          selloffer_push_enabled: data.selloffer_push_enabled,
          buyoffer_push_enabled: data.buyoffer_push_enabled,
        }

        // maybe add this to arclib as "app encrypted settings" or something?
        const tmpPool = new NostrPool(pool.ident)
        await tmpPool.setRelays(ARCADE_RELAYS)

        // change to nip44 once that merges
        const content = await pool.ident.nip04XEncrypt(
          pool.ident.privKey,
          ARCADE_PUBKEY,
          JSON.stringify(pushSettings),
        )

        // use replceable event - send an encrypted copy of these settings to ARCADE
        await tmpPool.send({
          kind: 30199,
          content,
          tags: [["d", "arcade-push"]],
        })

        tmpPool.close()
      }

      console.log("published profile")

      // navigate back
      navigation.goBack()
    } catch (e) {
      alert(`Failed to save settings: ${e}`)
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: () => (
        <Header
          title="Edit profile"
          leftIcon="back"
          leftIconColor={colors.palette.cyan400}
          onLeftPress={() => navigation.goBack()}
        />
      ),
    })
  }, [])

  useEffect(() => {
    async function fetchProfile() {
      const content = await profmgr.load()
      if (content) {
        setProfile(content)
      } else {
        console.log("user profile not found", userStore.pubkey)
      }
    }

    fetchProfile().catch(console.error)
  }, [userStore.pubkey])

  return (
    <Screen
      preset="scroll"
      style={$container}
      KeyboardAvoidingViewProps={{
        behavior: Platform.OS === "ios" ? "padding" : "height",
        keyboardVerticalOffset: 120,
      }}
      keyboardOffset={120}
      keyboardShouldPersistTaps="never"
    >
      <View style={$avatar}>
        <AutoImage
          source={{
            uri: picture || profile?.picture || "https://void.cat/d/HxXbwgU9ChcQohiVxSybCs.jpg",
          }}
          style={[$image, $avatarImage]}
        />
        {!loading ? (
          <Pressable onPress={() => imagePicker()} style={$avatarButton}>
            <ImagePlusIcon width={20} height={20} color={colors.palette.white} />
          </Pressable>
        ) : (
          <ActivityIndicator
            color={colors.palette.white}
            animating={loading}
            style={$avatarButton}
          />
        )}
      </View>
      <Formik
        innerRef={formikRef}
        enableReinitialize={true}
        initialValues={{
          display_name: profile?.display_name || "",
          name: profile?.name || "",
          username: profile?.username || "",
          picture: picture || profile?.picture,
          banner: profile?.banner || "",
          about: profile?.about || "",
          privchat_push_enabled: profile?.privchat_push_enabled || false,
          channel_push_enabled: profile?.channel_push_enabled || false,
          buyoffer_push_enabled: profile?.buyoffer_push_enabled || false,
          selloffer_push_enabled: profile?.selloffer_push_enabled || false,
        }}
        onSubmit={(values) => updateProfile(values)}
      >
        {({ values, handleChange, handleBlur, submitForm }) => (
          <View>
            <TextField
              label="Display Name"
              style={$input}
              inputWrapperStyle={$inputWrapper}
              onChangeText={handleChange("display_name")}
              onBlur={handleBlur("display_name")}
              value={values.display_name}
              autoCapitalize="none"
              autoFocus={false}
            />
            <TextField
              label="Name"
              style={$input}
              inputWrapperStyle={$inputWrapper}
              onChangeText={handleChange("name")}
              onBlur={handleBlur("name")}
              value={values.name}
              autoCapitalize="none"
              autoFocus={false}
            />
            <TextField
              label="Username"
              style={$input}
              inputWrapperStyle={$inputWrapper}
              onChangeText={handleChange("username")}
              onBlur={handleBlur("username")}
              value={values.username}
              autoCapitalize="none"
              autoFocus={false}
            />
            <TextField
              label="Bio"
              style={$input}
              inputWrapperStyle={$inputWrapper}
              onChangeText={handleChange("about")}
              onBlur={handleBlur("about")}
              value={values.about}
              autoCapitalize="none"
              autoFocus={false}
            />
            <Button text="Update" onPress={() => submitForm()} style={$button} />
          </View>
        )}
      </Formik>
    </Screen>
  )
})

const $container: ViewStyle = {
  flex: 1,
  paddingHorizontal: spacing.medium,
}

const $avatar: ViewStyle = {
  overflow: "hidden",
  alignSelf: "center",
  marginBottom: spacing.large,
  position: "relative",
}

const $image: ImageStyle = {
  width: "100%",
  height: "100%",
  resizeMode: "cover",
}

const $avatarImage: ImageStyle = {
  width: 80,
  height: 80,
  borderRadius: 100,
  borderWidth: 1,
  borderColor: colors.separator,
}

const $avatarButton: ViewStyle = {
  width: 80,
  height: 80,
  borderRadius: 100,
  position: "absolute",
  top: 0,
  left: 0,
  backgroundColor: colors.palette.overlay80,
  alignItems: "center",
  justifyContent: "center",
}

const $inputWrapper: ViewStyle = {
  padding: 0,
  alignItems: "center",
  backgroundColor: "transparent",
  borderWidth: 0,
  gap: spacing.extraSmall,
}

const $input: ViewStyle = {
  width: "100%",
  height: 50,
  borderWidth: 1,
  borderColor: colors.palette.cyan900,
  borderRadius: spacing.extraSmall,
  backgroundColor: colors.palette.overlay20,
  paddingHorizontal: spacing.medium,
  paddingVertical: 0,
  marginVertical: 0,
  marginHorizontal: 0,
  alignSelf: "center",
  marginBottom: spacing.small,
}

const $button: ViewStyle = {
  backgroundColor: colors.palette.cyan500,
  borderWidth: 0,
  width: "100%",
  marginTop: spacing.small,
  marginBottom: spacing.small,
  height: 50,
  minHeight: 50,
}
