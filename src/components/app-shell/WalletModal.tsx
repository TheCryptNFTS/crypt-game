import React from "react";

type Props = {
  open: boolean;
  connected: boolean;
  address: string | null;
  combatArchives: number | null;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function WalletModal(props: Props) {
  if (!props.open) return null;

  return (
    <div className="wallet-modal">
      <div className="wallet-modal__backdrop" onClick={props.onClose} />
      <div className="wallet-modal__panel">
        <h2>Wallet Access</h2>
        <p>
          Wallet is for ownership, NFT rewards, and profile proof.
          It should not block people from exploring the app.
        </p>

        <div className="wallet-modal__state">
          <span>Status</span>
          <strong>{props.connected ? "Connected" : "Not Connected"}</strong>
        </div>

        {props.address ? (
          <div className="wallet-modal__state">
            <span>Address</span>
            <strong>{props.address}</strong>
          </div>
        ) : null}

        {props.connected ? (
          <div className="wallet-modal__state">
            <span>Combat Archives</span>
            <strong>
              {props.combatArchives === null
                ? "Unverified"
                : `${props.combatArchives} held · on-chain`}
            </strong>
          </div>
        ) : null}

        <div className="wallet-modal__actions">
          {!props.connected ? (
            <button onClick={props.onConnect}>Connect Wallet</button>
          ) : (
            <button onClick={props.onDisconnect}>Disconnect</button>
          )}
          <button className="is-secondary" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
