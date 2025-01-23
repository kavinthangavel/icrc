#!/bin/bash
set -ex

# Set the network to the ICP playground
export DFX_NETWORK=playground

# Create identities (if they don't already exist)
dfx identity new alice --storage-mode=plaintext || true
dfx identity use alice
ALICE_PRINCIPAL=$(dfx identity get-principal)

dfx identity new bob --storage-mode=plaintext || true
dfx identity use bob
BOB_PRINCIPAL=$(dfx identity get-principal)

dfx identity new charlie --storage-mode=plaintext || true
dfx identity use charlie
CHARLIE_PRINCIPAL=$(dfx identity get-principal)

dfx identity new icrc_deployer --storage-mode=plaintext || true
dfx identity use icrc_deployer
ADMIN_PRINCIPAL=$(dfx identity get-principal)

# Deploy the icrc_backend canister on the ICP playground
dfx deploy icrc_backend --argument "(opt record {icrc1 = opt record {
  name = opt \"Kxvin\";
  symbol = opt \"KVN\";
  logo = opt \"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InJlZCIvPjwvc3ZnPg==\";
  decimals = 8;
  fee = opt variant { Fixed = 10000};
  minting_account = opt record{
    owner = principal \"$ADMIN_PRINCIPAL\";
    subaccount = null;
  };
  max_supply = null;
  min_burn_amount = opt 10000;
  max_memo = opt 64;
  advanced_settings = null;
  metadata = null;
  fee_collector = null;
  transaction_window = null;
  permitted_drift = null;
  max_accounts = opt 100000000;
  settle_to_accounts = opt 99999000;
};})" --mode reinstall

# Get the icrc_backend canister ID
ICRC_BACKEND_CANISTER=$(dfx canister id icrc_backend)
echo "ICRC Backend Canister ID: $ICRC_BACKEND_CANISTER"

# Deploy the frontend canister
dfx deploy icrc_frontend

# Get the frontend canister ID
FRONTEND_CANISTER=$(dfx canister id icrc_frontend)
echo "Frontend Canister ID: $FRONTEND_CANISTER"

# Initialize the icrc_backend canister
dfx canister call icrc_backend admin_init

# Query token details
dfx canister call icrc_backend icrc1_name --query
dfx canister call icrc_backend icrc1_symbol --query

dfx canister call icrc_backend icrc1_transfer "(record { 
  memo = null; 
  created_at_time=null;
  from_subaccount = null;
  amount = 10000000000;
  to = record { 
    owner = principal \"$ADMIN_PRINCIPAL\";
    subaccount = null;
  };
  fee = null
})"

# Mint tokens to Alice
dfx canister call icrc_backend icrc1_transfer "(record { 
  memo = null; 
  created_at_time=null;
  from_subaccount = null;
  amount = 10000000000;
  to = record { 
    owner = principal \"$ALICE_PRINCIPAL\";
    subaccount = null;
  };
  fee = null
})"


# Query total supply
dfx canister call icrc_backend icrc1_total_supply --query

# Query minting account
dfx canister call icrc_backend icrc1_minting_account --query

# Query supported standards
dfx canister call icrc_backend icrc1_supported_standards --query

# Query Alice's balance
dfx canister call icrc_backend icrc1_balance_of "(record { 
  owner = principal \"$ALICE_PRINCIPAL\";
  subaccount = null;
})" --query

# Transfer 500 tokens from Alice to Bob
dfx identity use alice
dfx canister call icrc_backend icrc1_transfer "(record { 
  memo = null; 
  created_at_time=null;
  amount = 50000000000;
  from_subaccount = null;
  to = record { 
    owner = principal \"$BOB_PRINCIPAL\";
    subaccount = null;
  };
  fee = opt 10000;
})"

# Query Alice's balance after transfer
dfx canister call icrc_backend icrc1_balance_of "(record { 
  owner = principal \"$ALICE_PRINCIPAL\";
  subaccount = null;
})" --query

# Query Bob's balance after transfer
dfx canister call icrc_backend icrc1_balance_of "(record { 
  owner = principal \"$BOB_PRINCIPAL\";
  subaccount = null;
})" --query

# Query Charlie's balance (should be 0)
dfx canister call icrc_backend icrc1_balance_of "(record { 
  owner = principal \"$CHARLIE_PRINCIPAL\";
  subaccount = null;
})" --query

# Bob burns tokens
dfx identity use bob
dfx canister call icrc_backend icrc1_transfer "(record { 
  memo = null; 
  created_at_time=null;
  amount = 100000000;
  from_subaccount = null;
  to = record { 
    owner = principal \"$ADMIN_PRINCIPAL\";
    subaccount = null;
  };
  fee = opt 10000;
})"

# Print frontend URL
echo "Frontend is running at: https://$FRONTEND_CANISTER.ic0.app"