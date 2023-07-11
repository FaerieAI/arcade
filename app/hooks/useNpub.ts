import { useStores } from "app/models"
import { nip19 } from "nostr-tools"

export function useNpub() {
  const { userStore } = useStores()
  const npub = nip19.npubEncode(userStore.pubkey)

  // Add copy button to copy the npub code  
  const [copied, setCopied] = React.useState(false);

  return (  
    <>  
      <Text style={styles.text}>{npub}</Text>  

      <TouchableOpacity onPress={() => {  
        Clipboard.setString(npub);  
        setCopied(true);  

        setTimeout(() => {  
          setCopied(false);  
        }, 2000);  

      }}>  

        <Text style={styles.copyButton}>{copied ? 'Copied' : 'Copy'}</Text>  

      </TouchableOpacity>    

    </>    

    )    														       }
