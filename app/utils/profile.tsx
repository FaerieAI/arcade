import { ArcadeIdentity, NostrPool } from "app/arclib/src"
import { ProfileManager, Profile } from "app/arclib/src/profile"
import { registerForPushNotifications } from "./notification"
import { Contact } from "app/arclib/src/contacts"

export type PrivateSettings = {
  privchat_push_enabled: boolean
  channel_push_enabled: boolean
  buyoffer_push_enabled: boolean
  selloffer_push_enabled: boolean
}

// good to have a few non-arcade backups
const ARCADE_RELAYS = [
  "wss://relay.arcade.city",
  "wss://arc1.arcadelabs.co",
  "wss://relay.nostr.band/all",
  "wss://relay.damus.io",
  "wss://nos.lol",
]

const ARCADE_PUBKEY = "c4899d1312a7ccf42cc4bfd0559826d20f7564293de4588cb8b089a574d71757"

export async function getProfile(ident: ArcadeIdentity, pubkey: string) {
  const tmpPool = new NostrPool(ident)
  await tmpPool.setRelays(ARCADE_RELAYS)

  const contacts: Array<Contact> = []
  let profile: Profile = {}

  const list = await tmpPool.list([{ kinds: [0, 3], authors: [pubkey] }], true)
  const metadata = list.filter((el) => el.kind === 0)?.slice(-1)[0]
  const follows = list.filter((el) => el.kind === 3)?.slice(-1)[0]

  if (metadata) {
    profile = JSON.parse(metadata.content)
  }

  if (follows) {
    follows.tags.forEach((item) => {
      contacts.push({ pubkey: item[1], secret: false, legacy: true })
    })
  }

  // close tmp pool
  tmpPool.close()

  return { profile, contacts }
}

export async function updateProfile(profmgr: ProfileManager, profile: Profile & PrivateSettings) {
  // save public and private settings
  await profmgr.save(profile, [
    "privchat_push_enabled",
    "channel_push_enabled",
    "buyoffer_push_enabled",
    "selloffer_push_enabled",
  ])

  // update arcade push notification settings
  if (
    profile.privchat_push_enabled ||
    profile.channel_push_enabled ||
    profile.buyoffer_push_enabled ||
    profile.selloffer_push_enabled
  ) {
    const pool = profmgr.pool
    const token = await registerForPushNotifications()

    const pushSettings = {
      pubkey: pool.ident.pubKey,
      token,
      privchat_push_enabled: profile.privchat_push_enabled,
      channel_push_enabled: profile.channel

    const tmpPool = new NostrPool(pool.ident)
    await tmpPool.setRelays(ARCADE_RELAYS)

    // change to nip44 once that merges
    const content = await pool.ident.nip04XEncrypt(
      pool.ident.privKey,
      ARCADE_PUBKEY,
      JSON.stringify(pushSettings),
    )

    // use replceable event
    await tmpPool.send({
      kind: 30199,
      content,
      tags: [
        ["d", "arcade-push"],
        ["p", ARCADE_PUBKEY],
      ],
    })

    // close tmp pool
    tmpPool.close()
  }
}
