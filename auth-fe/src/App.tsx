import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import awsConfig from "./aws-exports.json";
import { Amplify, Auth, Hub } from "aws-amplify";
import { CognitoHostedUIIdentityProvider } from "@aws-amplify/auth";
import axios from "axios";

const isLocalhost = Boolean( 
  window.location.hostname === "localhost" ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === "[::1]" ||
    // 127.0.0.1/8 is considered localhost for IPv4.
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

// Assuming you have two redirect URIs, and the first is for localhost and second is for production
const [productionRedirectSignIn, localRedirectSignIn] =
  awsConfig.oauth.redirectSignIn.split(",");

const [productionRedirectSignOut, localRedirectSignOut] =
  awsConfig.oauth.redirectSignOut.split(",");

const updatedAwsConfig = {
  ...awsConfig,
  oauth: {
    ...awsConfig.oauth,
    redirectSignIn: isLocalhost
      ? localRedirectSignIn
      : productionRedirectSignIn,
    redirectSignOut: isLocalhost
      ? localRedirectSignOut
      : productionRedirectSignOut,
  },
};

Amplify.configure(updatedAwsConfig);

function App() {
  const [user, setUser] = useState(null);
  const [customState, setCustomState] = useState(null);

  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload: { event, data } }) => {
      switch (event) {
        case "signIn":
          setUser(data);
          console.log(event, data);
          break;
        case "signOut":
          console.log(event, data);
          setUser(null);
          break;
        case "customOAuthState":
          setCustomState(data);
          console.log(event, data);
      }
    });

    Auth.currentAuthenticatedUser()
      .then((currentUser) => {
        setUser(currentUser);
        console.log(currentUser);
      })
      .catch(() => console.log("Not signed in"));

    return unsubscribe;
  }, []);

  const handlePrivate = () => {
    const jwtToken =(user as any)?.signInUserSession?.accessToken?.jwtToken ;
    axios.get("http://localhost:3500/users/test", {
      headers: {
        accesstoken: jwtToken || ''
      }
    });
  }

  return (
    <div className="App" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
    }}>
      <button onClick={() => Auth.federatedSignIn()}>Open Hosted UI</button>
      <button onClick={handlePrivate}>Get Private Info</button>
      <button
        onClick={() =>
          Auth.federatedSignIn({
            provider: CognitoHostedUIIdentityProvider.Google,
          })
        }
      >
        Open Google
      </button>
      <button onClick={() => Auth.signOut()}>Sign Out</button>
    </div>
  );
}

export default App;
