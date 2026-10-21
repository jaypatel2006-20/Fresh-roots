const C = {
  Verified: 'g',
  Delivered: 'g',
  Active: 'g',
  Resolved: 'g',
  Pending: 'y',
  Placed: 'y',
  Preparing: 'b',
  Confirmed: 'b',
  'Out for Delivery': 'b',
  Rejected: 'r',
  Cancelled: 'r',
  Suspended: 'r',
  High: 'r',
  Disabled: 'r',
};
export const Badge = ({ s }) => <span className={'badge ' + (C[s] || '')}>{s}</span>;
export const Modal = ({ title, onClose, children }) => (
  <div className="ov" onClick={onClose}>
    <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <h3>{title}</h3>
      {children}
    </div>
  </div>
);
export const Confirm = ({ msg, onYes, onClose }) => (
  <Modal title="Please confirm" onClose={onClose}>
    <p>{msg}</p>
    <div className="row">
      <button className="btn ghost" onClick={onClose}>
        Cancel
      </button>
      <button
        className="btn"
        onClick={() => {
          onYes();
          onClose();
        }}
      >
        Confirm
      </button>
    </div>
  </Modal>
);
export const Img = ({ n }) => (
  <div className="img" role="img" aria-label={n}>
    {n[0]}
  </div>
);
export const Empty = ({ t, children }) => (
  <div className="card center">
    <h3>{t}</h3>
    {children}
  </div>
);
export const m = (n) => '₹' + n;
