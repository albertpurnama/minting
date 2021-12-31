import { BigNumber, ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';

// ********************************
// START OF CONSTANTS
// ********************************
const ATTR_CONTRACT_ADDRESS = 'data-td-web3-contract-address';
const ATTR_PROTECTED_PATHS = 'data-td-web3-protected-paths';
const ATTR_FAIL_REDIRECT_PATH = 'data-td-web3-fail-redirect-path';
const ATTR_DISCORD_CHANNEL_ID = 'data-td-discord-channel-id';
const ATTR_CONTRACT_CHAIN_ID = 'data-td-contract-chain-id';

// Supported chains
const chainMap = {
  "0x89": {
    rpcURL: "https://polygon-rpc.com/",
  },
  "0x1": {
    // use whatever from metamask, this shouldn't be used
  }
}

const funcCalls = ["function balanceOf(address _owner) external view returns(uint256)"];
const connectWalletButtonId = 'web3-auth-connect-button';

// const TOKEN_CONTRACT_ADDRESS = "0xc1C6A331D4013f40Ca830C06eD47564D0d2b21cD";
// const redirectPath = '/';
// const protectedPaths = '/private, /blog';
const redirectPath = getScriptAttribute(ATTR_FAIL_REDIRECT_PATH);
if (!redirectPath) {
  throw `fail redirect path not found. ${ATTR_FAIL_REDIRECT_PATH} is required!`
}
const protectedPaths = getScriptAttribute(ATTR_PROTECTED_PATHS);
if (!protectedPaths) {
  throw `protected path not found. ${ATTR_PROTECTED_PATHS} is required!`
}
const TOKEN_CONTRACT_ADDRESS = getScriptAttribute(ATTR_CONTRACT_ADDRESS);
if (!TOKEN_CONTRACT_ADDRESS) {
  throw `token contract address not found. ${ATTR_CONTRACT_ADDRESS} is required!`
}
const discordChannelID = getScriptAttribute(ATTR_DISCORD_CHANNEL_ID);
const contractChainID = getScriptAttribute(ATTR_CONTRACT_CHAIN_ID) || '0x1';

// ********************************
// END OF CONSTANTS
// ********************************

// ********************************
// START OF UTILITY FUNCTIONS
// ********************************
// retryAfter runs f every t for n times, only terminates after
// either f runs n times or f returns true
const retryAfter = (f: () => boolean, t: number, n: number) => {
  if (n < 1 || f()) return;
  setTimeout(() => retryAfter(f, t, n - 1), t)
}

function getScriptAttribute(attr: string): string | null {
  return document
    .querySelector(`[${attr}]`)
    ?.getAttribute(`${attr}`);
}
// ********************************
// END OF UTILITY FUNCTIONS
// ********************************

// ********************************
// START OF STATES
// ********************************
let currentAccount = null;
// ********************************
// END OF STATES
// ********************************

// ********************************
// START OF UI COMPONENTS
// ********************************
const OverlayContainerID = "typedream-web3-auth-loading-container"
const renderOverlay = (elem: HTMLElement) => {
  console.log('rendering Overlay');
  let overlayContainer = document.createElement('div');
  overlayContainer.id = OverlayContainerID;
  overlayContainer.style.position = 'absolute';
  overlayContainer.style.left = '0';
  overlayContainer.style.top = '0';
  overlayContainer.style.opacity = '0.5';
  overlayContainer.style.height = '100vh';
  overlayContainer.style.width = '100vw';
  overlayContainer.style.background = 'gray';
  overlayContainer.style.display = 'flex';
  overlayContainer.style.alignItems = 'center';
  overlayContainer.style.justifyContent = 'center';

  let loadingContainer = document.createElement('div');
  loadingContainer.style.height = '100px';
  loadingContainer.style.width = '100px';
  loadingContainer.style.borderRadius = '20px';
  loadingContainer.style.background = 'white';
  loadingContainer.style.display = 'flex';
  loadingContainer.style.alignItems = 'center';
  loadingContainer.style.justifyContent = 'center';

  let loadingCircle = document.createElement('div');
  loadingCircle.style.border = '10px solid #f3f3f3';
  loadingCircle.style.borderTop = '10px solid #3498db';
  loadingCircle.style.borderRadius = '50%';
  loadingCircle.style.width = '50px';
  loadingCircle.style.height = '50px';
  loadingCircle.style.animation = 'auth-spin 1s linear infinite';

  let loadingStyle = document.createElement("style");
  loadingStyle.textContent = `
    @keyframes auth-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  loadingContainer.appendChild(loadingStyle);
  loadingContainer.appendChild(loadingCircle);
  overlayContainer.appendChild(loadingContainer);

  elem.appendChild(overlayContainer);
}

const removeLoading = () => {
  const overlayContainer = document.getElementById(OverlayContainerID);
  if (!overlayContainer) {
    setTimeout(removeLoading, 0);
    return;
  }
  overlayContainer.style.display = "none";
}

const attachConnectButtonHandlers = (): boolean => {
  const connectWalletButtons = document.querySelectorAll(`[href*='#${connectWalletButtonId}']`);
  if (!connectWalletButtons || connectWalletButtons?.length === 0) return false

  console.log('attaching to ', connectWalletButtons.length, ' buttons ');

  connectWalletButtons?.forEach((btn) => btn.addEventListener('click', (ev) => {
    console.log('connecting wallet button');
    ev.preventDefault();
    const redirectAfterSuccessURL = btn.getAttribute('href');
    handleRequestAccount(redirectAfterSuccessURL);
  }))

  return true
}
// ********************************
// END OF UI COMPONENTS
// ********************************

// ********************************
// START OF HANDLERS IMPLEMENTATION
// ********************************

// handleUnauthorized handles unauthorized access to the page.
function handleUnauthorized() {
  // redirect out
  window.location.href = redirectPath;
  removeLoading();

  // TEMPORARY
  console.log('unauthorized');
}

// If the provider returned by detectEthereumProvider is not the same as
// window.ethereum, something is overwriting it, perhaps another wallet.
function handleInconsistentProvider() {
  console.error('inconsistent ethereum provider, please disconnect any wallet that\'s not metamask')
}

// handleAuthentication
async function handleAuthentication() {
  if (!currentAccount) handleUnauthorized();

  try {
    const { ethereum } = (window as any);

    if (ethereum) {
      const provider = new ethers.providers.Web3Provider(ethereum);

      const signer = provider.getSigner();
      const connectedContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, funcCalls, signer);
      console.log(signer, currentAccount);

      let bal = (await connectedContract.balanceOf(currentAccount)) as BigNumber;

      // Condition in which the user should not be able to authenticate.
      if (!bal.gt(BigNumber.from(0))) {
        handleUnauthorized();
        throw "unauthorized";
      }

      handleAuthenticationSuccessful();
    } else {
      console.log("Ethereum object doesn't exist!");
    }
  } catch (error) {
    handleUnauthorized();
    // need to bubble up the throw here so it's caught by handleRequestAccount
    throw error;
  }
}

const handleAuthenticationSuccessful = () => {
  removeLoading();
}

// requestChangeNetwork sends request to wallet to change ethereum chain
const requestChangeNetwork = async () => {
  // Check if MetaMask is installed
  // MetaMask injects the global API into window.ethereum
  const { ethereum } = window as any;
  if (ethereum) {
    try {
      console.log('requesting chain switch')
      // check if the chain to connect to is installed
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: contractChainID }], // chainId must be in hexadecimal numbers
      });
    } catch (error) {
      // This error code indicates that the chain has not been added to MetaMask
      // if it is not, then install it into the user MetaMask
      if (error.code === 4902) {
        // make sure we support the chain.
        if (!chainMap[contractChainID]) throw "Chain not supported yet!";
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: contractChainID,
                rpcUrl: chainMap[contractChainID].rpcURL,
              },
            ],
          });
        } catch (addError) {
          console.error(addError);
        }
      }
      console.error(error);
    }
  } else {
    // if no window.ethereum then MetaMask is not installed
    alert('MetaMask is not installed. Please consider installing it: https://metamask.io/download.html');
  }
}

// handleChainChanged should handle chain changes per EIP-1193
const handleChainChanged = async (chainId: string) => {
  if (chainId != contractChainID) {
    // request change network first
    await requestChangeNetwork();
  }
  // window.location.reload();
  await handleAuthentication();
}

// handleAccountsChanged handles re-authorization when account is changed
const handleAccountsChanged = async (accounts: Array<string>) => {
  if (accounts.length === 0) {
    // handleRequestAccount();
    handleUnauthorized();
  } else {
    currentAccount = accounts[0];
  }

  // Check whether etherum provider exist.
  const { ethereum } = window as any;
  if (!ethereum) handleUnauthorized();

  // check if this account is connected to the correct chain
  await ethereum
    .request({ method: 'eth_chainId' })
    .then(handleChainChanged)
    .catch((e) => {
      console.log('handleAccountsChanged throw error'); throw e
    })
}

const handleAccountsRequestError = (err: any) => {
  console.log("account request error")
  console.error(err);
}

// handleRequestAccount requests wallet connection.
function handleRequestAccount(successRedirectURL: string) {
  const { ethereum } = window as any;
  if (!ethereum) handleUnauthorized();
  ethereum.request({ method: 'eth_requestAccounts' })
    .then(handleAccountsChanged)
    .then(async () => {
      console.log('handleAccountsChanged');
      if (discordChannelID) {
        const url = "https://discord-mask-h6fe4.ondigitalocean.app/v0/discord/instant-invite"
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            channel_id: discordChannelID
          })
        })
          .then(r => r.text())
          .then(redirectURL => window.location.href = redirectURL)
      } else {
        window.location.href = successRedirectURL
      }
    })
    .catch(handleAccountsRequestError);
}

// isProtectedPage checks whether current location
// is protected, if it is protected, return true
const isProtectedPage = (): boolean => {
  const loc = window.location.pathname;
  if (!loc) return false;

  // only paths that starts with /x will be protected
  return protectedPaths
    .split(',')
    .map((val) => val.replace(/\s/g, ""))
    .some((val) => loc.startsWith(val));
}

function unsafeCheckTypedreamSite(): boolean {
  return document.head.querySelector('link[rel=\'icon\'][href^=\'https://api.typedream.com\']') !== null;
}
// ********************************
// END OF HANDLERS IMPLEMENTATION
// ********************************

// ********************************
// START OF INITIALIZATION
// ********************************
// Check whether this is a protected page based on path
console.log('connected v0.1.3')
const pageIsProtected = isProtectedPage();
const isTypedreamSite = unsafeCheckTypedreamSite();

// attach DOM components after DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // attach handlers to buttons
  retryAfter(attachConnectButtonHandlers, 200, 10);
})

if (isTypedreamSite && pageIsProtected) {
  // attach DOM components after DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    // attach overlay
    let bodyElem = document.getElementsByTagName('body')?.[0];
    if (bodyElem) renderOverlay(bodyElem);
  })

  // Check whether etherum provider exist.
  const { ethereum } = window as any;
  if (!ethereum) handleUnauthorized();

  // Detect which Ethereum network the user is connected to
  detectEthereumProvider().then((provider) => {
    if (provider != ethereum) handleInconsistentProvider();
  });

  // Check connected user's account.
  ethereum
    .request({ method: 'eth_accounts' })
    .then(handleAccountsChanged)
    .catch(handleAccountsRequestError)

  ethereum.on('accountsChanged', handleAccountsChanged)
} else {
  removeLoading();
}
// ********************************
// END OF INITIALIZATION
// ********************************
