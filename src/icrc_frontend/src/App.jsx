import { useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import "./styles.css";

const App = () => {
  const [authClient, setAuthClient] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState('');
  const [balance, setBalance] = useState(0);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transferForm, setTransferForm] = useState({ to: '', amount: '' });

  // DFX environment variables
  const tokenCanisterId = process.env.CANISTER_ID_ICRC_BACKEND;
  const network = process.env.DFX_NETWORK;

  useEffect(() => {
    const initAuth = async () => {
      const client = await AuthClient.create();
      setAuthClient(client);
      if (await client.isAuthenticated()) {
        handleAuthentication(client);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    const loadTokenInfo = async () => {
      const actor = await createTokenActor();
      try {
        const [name, symbol, decimals, fee, totalSupply] = await Promise.all([
          actor.icrc1_name(),
          actor.icrc1_symbol(),
          actor.icrc1_decimals(),
          actor.icrc1_fee(),
          actor.icrc1_total_supply(),
        ]);
        
        setTokenInfo({
          name,
          symbol,
          decimals: Number(decimals),
          fee: Number(fee) / (10 ** Number(decimals)),
          totalSupply: Number(totalSupply) / (10 ** Number(decimals)),
        });
      } catch (error) {
        console.error('Error loading token info:', error);
      }
    };
    loadTokenInfo();
  }, []);

  const createTokenActor = async () => {
    const agent = new HttpAgent({ 
      host: network === 'playground' ? 'https://icp0.io' : 'http://localhost:4943'
    });
    
    if (network !== 'ic') {
      await agent.fetchRootKey();
    }

    return Actor.createActor(
      ({ IDL }) => {
        return IDL.Service({
          icrc1_name: IDL.Func([], [IDL.Text], ['query']),
          icrc1_symbol: IDL.Func([], [IDL.Text], ['query']),
          icrc1_decimals: IDL.Func([], [IDL.Nat8], ['query']),
          icrc1_fee: IDL.Func([], [IDL.Nat], ['query']),
          icrc1_total_supply: IDL.Func([], [IDL.Nat], ['query']),
          icrc1_balance_of: IDL.Func([
            IDL.Record({
              owner: IDL.Principal,
              subaccount: IDL.Opt(IDL.Vec(IDL.Nat8))
            })
          ], [IDL.Nat], ['query']),
          icrc1_transfer: IDL.Func([
            IDL.Record({
              to: IDL.Record({
                owner: IDL.Principal,
                subaccount: IDL.Opt(IDL.Vec(IDL.Nat8))
              }),
              amount: IDL.Nat,
              fee: IDL.Opt(IDL.Nat),
              memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
              from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
              created_at_time: IDL.Opt(IDL.Nat64)
            })
          ], [IDL.Variant({ Ok: IDL.Nat, Err: IDL.Text })], [])
        });
      },
      {
        agent,
        canisterId: tokenCanisterId,
      }
    );
  };

  const handleLogin = async () => {
    if (!authClient) return;
    
    await new Promise((resolve) => {
      authClient.login({
        identityProvider: 'https://identity.ic0.app',
        onSuccess: () => {
          handleAuthentication(authClient);
          resolve();
        },
      });
    });
  };

  const handleAuthentication = async (client) => {
    const identity = client.getIdentity();
    const principal = identity.getPrincipal().toString();
    setPrincipal(principal);
    setIsAuthenticated(true);
    updateBalance(principal);
  };

  const updateBalance = async (principal) => {
    try {
      const actor = await createTokenActor();
      const balance = await actor.icrc1_balance_of({
        owner: Principal.fromText(principal),
        subaccount: [],
      });
      const decimals = tokenInfo?.decimals || 8;
      setBalance(Number(balance) / (10 ** decimals));
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!isAuthenticated || !tokenInfo) return;
    
    setLoading(true);
    try {
      const actor = await createTokenActor();
      const rawAmount = BigInt(Math.floor(Number(transferForm.amount) * (10 ** tokenInfo.decimals)));
      
      const result = await actor.icrc1_transfer({
        to: {
          owner: Principal.fromText(transferForm.to),
          subaccount: [],
        },
        amount: rawAmount,
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });

      if ('Ok' in result) {
        alert('Transfer successful!');
        updateBalance(principal);
        setTransferForm({ to: '', amount: '' });
      } else {
        alert(`Transfer failed: ${result.Err}`);
      }
    } catch (error) {
      console.error('Transfer error:', error);
      alert('Transfer failed');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="container">
      <h1>{tokenInfo?.name || 'Token'} Dashboard</h1>
      
      <section className="token-info">
        <h2>Token Information</h2>
        {tokenInfo ? (
          <div>
            <p>Symbol: {tokenInfo.symbol}</p>
            <p>Decimals: {tokenInfo.decimals}</p>
            <p>Transaction Fee: {tokenInfo.fee} {tokenInfo.symbol}</p>
            <p>Total Supply: {tokenInfo.totalSupply.toLocaleString()} {tokenInfo.symbol}</p>
          </div>
        ) : (
          <p>Loading token information...</p>
        )}
      </section>

      <section className="user-section">
        <h2>Account</h2>
        {isAuthenticated ? (
          <div>
            <p>Principal: {principal}</p>
            <p>Balance: {balance.toFixed(tokenInfo?.decimals || 8)} {tokenInfo?.symbol}</p>
          </div>
        ) : (
          <button onClick={handleLogin}>Login with Internet Identity</button>
        )}
      </section>

      {isAuthenticated && (
        <section className="transfer-section">
          <h2>Transfer Tokens</h2>
          <form onSubmit={handleTransfer}>
            <div className="form-group">
              <label>Recipient Principal:</label>
              <input
                type="text"
                value={transferForm.to}
                onChange={(e) => setTransferForm({ ...transferForm, to: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Amount ({tokenInfo?.symbol}):</label>
              <input
                type="number"
                step="any"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                required
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Transfer'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
};

export default App;
