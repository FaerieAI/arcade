import {
  Instance,
  SnapshotIn,
  SnapshotOut,
  applySnapshot,
  flow,
  cast,
  types,
} from "mobx-state-tree"
import { withSetPropAction } from "./helpers/withSetPropAction"
import {
  ArcadeIdentity,
  BlindedEvent,
  ChannelInfo,
  ChannelManager,
  NostrEvent,
  NostrPool,
  PrivateMessageManager,
} from "app/arclib/src"
import { ChannelModel } from "./Channel"
import { MessageModel } from "./Message"
import { generatePrivateKey, getPublicKey, nip19 } from "nostr-tools"
import * as SecureStore from "expo-secure-store"
import * as storage from "../utils/storage"
import { ContactManager, Contact } from "app/arclib/src/contacts"
import { ContactModel } from "./Contact"
import { schnorr } from "@noble/curves/secp256k1"
import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"
import { runInAction } from "mobx"
import { Profile, ProfileManager } from "app/arclib/src/profile"
import { PrivateSettings, getProfile, updateProfile } from "app/utils/profile"

const utf8Encoder = new TextEncoder()
const DEFAULT_CHANNELS = [
  "8b28c7374ba5891ea65db9a2d1234ecc369755c35f6db1a54f18424500dea4a0",
  "5b93e807c4bc055693be881f8cfe65b36d1f7e6d3b473ee58e8275216ff74393",
  "3ff1f0a932e0a51f8a7d0241d5882f0b26c76de83f83c1b4c1efe42adadb27bd",
]

async function secureSet(key, value) {
  return await SecureStore.setItemAsync(key, value)
}
async function secureGet(key) {
  return await SecureStore.getItemAsync(key)
}
async function secureDel(key) {
  return await SecureStore.deleteItemAsync(key)
}

async function registerNip05(ident: ArcadeIdentity, name: string) {
  if (name.includes("@")) {
    // user should log in, not try to attach an existing nip05
    throw Error("Log in with your private key instead")
  }
  const ser = JSON.stringify([0, ident.pubKey, name])
  const hashB = sha256(utf8Encoder.encode(ser))
  const hashH = bytesToHex(hashB)
  const sig = bytesToHex(schnorr.sign(hashH, ident.privKey))
  const url = `https://uzxdj4za3vfn7czid274iwqvwq0kukze.lambda-url.us-east-2.on.aws/?name=${name}&pubkey=${ident.pubKey}&sig=${sig}`
  const response = await fetch(url)
  const js = await response.json()
  if (js.error) {
    throw new Error(js.error)
  }
  return `${name}@arcade.chat`
}

/**
 * Model description here for TypeScript hints.
 */
export const UserStoreModel = types
  .model("UserStore")
  .props({
    pubkey: "",
    privkey: "",
    metadata: types.maybeNull(
      types.model({
        picture: types.optional(types.string, "https://void.cat/d/HxXbwgU9ChcQohiVxSybCs.jpg"),
        banner: types.optional(types.string, "https://void.cat/d/2qK2KYMPHMjMD9gcG6NZcV.jpg"),
        username: types.optional(types.string, "-"),
        nip05: types.optional(types.string, ""),
        display_name: types.optional(types.string, ""),
        about: types.optional(types.string, ""),
        privchat_push_enabled: types.optional(types.boolean, false),
        channel_push_enabled: types.optional(types.boolean, false),
        buyoffer_push_enabled: types.optional(types.boolean, false),
        selloffer_push_enabled: types.optional(types.boolean, false),
      }),
    ),
    isLoggedIn: false,
    channels: types.array(types.reference(ChannelModel)),
    contacts: types.optional(types.array(ContactModel), []),
    privMessages: types.optional(types.array(MessageModel), []),
    relays: types.optional(types.array(types.string), [
      "wss://relay.arcade.city",
      "wss://arc1.arcadelabs.co",
      "wss://relay.damus.io",
    ]),
  })
  .actions(withSetPropAction)
  .views((self) => ({
    get getChannels() {
      return self.channels.slice()
    },
    findContact(pubkey: string) {
      return self.contacts.find((el) => el.pubkey === pubkey)
    },
    get getContacts() {
      return self.contacts.slice()
    },
    get getRelays() {
      return self.relays.slice()
    },
    get getMetadata() {
      return self.metadata
    },
    get getPrivMesages() {
      return [...new Map(self.privMessages.slice().map((item) => [item.pubkey, item])).values()]
    },
  })) // eslint-disable-line @typescript-eslint/no-unused-vars
  .actions((self) => ({
    fetchPrivMessages: flow(function* (pool: NostrPool, contacts?: Array<Contact>) {
      const priv = new PrivateMessageManager(pool)
      let keys: string[]
      if (contacts) {
        keys = contacts.map((c) => c.pubkey)
      } else {
        keys = self.contacts.map((c) => c.pubkey)
      }
      // this doesn't work... you get mobx errors
      // but we should be able to update the state!

      /*
      const modifyProp = async (ev: BlindedEvent) => {
        if (self.privMessages.every(msg=>{
            if (msg.pubkey === ev.pubkey) {
              console.log("modding", ev.pubkey)
              msg.setProp("content", ev.content)
              msg.setProp("blinded", ev.blinded)
              msg.setProp("lastMessageAt", ev.created_at)
              return false
            }
           return true
        })) {
          // append!
        }
      }
      */

      // this updates the home screen prop when new messages arrive
      // by passing in all our contact keys, we can decrypt new blinded messages
      const list = yield priv.list({ limit: 500 }, false, keys)
      const map = new Map<string, NostrEvent>()
      list.forEach((ev) => {
        const was = map.get(ev.pubkey)
        if (!was || ev.created_at > was.created_at) {
          map.set(ev.pubkey, ev)
        }
      })
      type ExtendedItem = NostrEvent & { lastMessageAt?: number; name?: string }
      const uniqueList: ExtendedItem[] = [...map.values()]
      for (const item of uniqueList) {
        item.lastMessageAt = item.created_at
      }
      return uniqueList
    }),
  }))
  .actions((self) => ({
    joinChannel(mgr: ChannelManager, info: ChannelInfo) {
      const index = self.channels.findIndex((el: { id: string }) => el.id === info.id)
      if (index === -1) self.channels.push(ChannelModel.create(info))
      mgr.joinAll(self.channels.map((el) => el.id))
    },
    leaveChannel(mgr: ChannelManager, id: string) {
      const index = self.channels.findIndex((el: { id: string }) => el.id === id)
      if (index !== -1) self.channels.splice(index, 1)
      mgr.leave(id)
    },
    async afterCreate() {
      const sec = await secureGet("privkey")
      if (sec) {
        const pubkey = await getPublicKey(sec)
        const meta = await storage.load("meta")
        runInAction(() => {
          self.setProp("privkey", sec)
          self.setProp("pubkey", pubkey)
          self.setProp("isLoggedIn", true)
          self.setProp("metadata", meta)
        })
      }
    },
    signup: flow(function* (
      pool: NostrPool,
      picture: string,
      username: string,
      displayName: string,
      about: string,
    ) {
      const privkey = generatePrivateKey()
      const pubkey = getPublicKey(privkey)

      // update pool with ident
      const id = new ArcadeIdentity(privkey)
      pool.ident = id

      // register nip-05
      const nip05 = yield registerNip05(id, username)

      // publish user to relay
      const meta = { picture, display_name: displayName, username, about, nip05 }
      const res = yield pool.send({
        content: JSON.stringify(meta),
        tags: [],
        kind: 0,
      })
      console.log("publish user", res)

      applySnapshot(self, {
        pubkey,
        privkey,
        isLoggedIn: true,
        metadata: meta,
        channels: DEFAULT_CHANNELS,
      })

      yield secureSet("privkey", privkey)
      yield storage.save("meta", meta)
    }),
    loginWithNsec: flow(function* (pool: NostrPool, mgr: ChannelManager, nsec: string) {
      if (!nsec.startsWith("nsec1") || nsec.length < 60) {
        return
      }
      try {
        const { data } = nip19.decode(nsec)
        const privkey = data as string
        const pubkey = getPublicKey(privkey)

        const ident = new ArcadeIdentity(privkey)
        pool.ident = ident

        const { profile, contacts } = yield getProfile(ident, pubkey)
        // update secure storage
        yield secureSet("privkey", privkey)
        // fetch priv messages
        const privMessages = yield self.fetchPrivMessages(pool, contacts)

        // update mobx state, user will redirect to home screen immediately
        const tmp = yield mgr.listJoined()
        tmp.forEach((id: string) => {
          ChannelModel.create({ id, privkey: "" })
        })
        const joinedChannels = tmp.length > 0 ? tmp : DEFAULT_CHANNELS

        applySnapshot(self, {
          pubkey,
          privkey,
          isLoggedIn: true,
          metadata: profile,
          contacts,
          channels: joinedChannels,
          privMessages,
        })
      } catch (e: any) {
        console.log(e)
        alert("Invalid key. Did you copy it correctly?")
      }
    }),
    async logout() {
      await secureDel("privkey")
      applySnapshot(self, {
        pubkey: "",
        privkey: "",
        isLoggedIn: false,
        channels: [],
        contacts: [],
      })
    },
    fetchContacts: flow(function* (mgr: ContactManager) {
      if (!self.pubkey) throw new Error("pubkey not found")
      const res = yield mgr.list()
      self.setProp("contacts", res)
    }),
    addContact: flow(function* (
      contact: Contact & { metadata?: string },
      mgr: ContactManager,
      metadata?: string,
    ) {
      yield mgr.add(contact)
      if (metadata) contact.metadata = metadata
      const index = self.contacts.findIndex(
        (el: { pubkey: string }) => el.pubkey === contact.pubkey,
      )
      if (index === -1) {
        self.contacts.push(contact)
      } else {
        self.contacts[index].setProp("legacy", contact.legacy)
        self.contacts[index].setProp("secret", contact.secret)
      }
    }),
    removeContact: flow(function* (pubkey: string, mgr: ContactManager) {
      yield mgr.remove(pubkey)
      const index = self.contacts.findIndex((el: { pubkey: string }) => el.pubkey === pubkey)
      if (index !== -1) self.contacts.splice(index, 1)
    }),
    addRelay(url: string) {
      const index = self.relays.findIndex((el: string) => el === url)
      if (index === -1) self.relays.push(url)
    },
    removeRelay(url: string) {
      const index = self.relays.findIndex((el: string) => el === url)
      if (index !== -1) self.relays.splice(index, 1)
    },
    addPrivMessage(ev: BlindedEvent) {
      self.privMessages.push({
        ...ev,
        lastMessageAt: ev.created_at,
      })
    },
    updatePrivMessages(data) {
      self.privMessages = cast(data)
    },
    updateChannels: flow(function* (mgr: ChannelManager) {
      const list = yield mgr.listChannels(true)
      list.forEach((ch) => {
        if (ch.is_private) {
          const idx = self.channels.findIndex((el) => el.id === ch.id)
          if (idx !== -1) {
            self.channels[idx].setProp("privkey", ch.privkey)
          }
        }
      })
    }),
    fetchMetadata: flow(function* () {
      const ident = new ArcadeIdentity(self.privkey)
      const { profile } = yield getProfile(ident, self.pubkey)
      self.setProp("metadata", profile)
    }),
    updateMetadata: flow(function* (data: Profile & PrivateSettings, profmgr?: ProfileManager) {
      if (profmgr) {
        yield updateProfile(profmgr, data)
      }
      self.setProp("metadata", data)
    }),
  })) // eslint-disable-line @typescript-eslint/no-unused-vars

export interface UserStore extends Instance<typeof UserStoreModel> {}
export interface UserStoreSnapshotOut extends SnapshotOut<typeof UserStoreModel> {}
export interface UserStoreSnapshotIn extends SnapshotIn<typeof UserStoreModel> {}
export const createUserStoreDefaultModel = () => types.optional(UserStoreModel, {})
