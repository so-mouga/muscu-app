import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Interrupteur({ on, onChange, label, aide }) {
    return (_jsxs("button", { type: "button", className: 'interrupteur' + (on ? ' on' : ''), onClick: () => onChange(!on), children: [_jsxs("span", { children: [label, aide && _jsx("div", { className: "faible", children: aide })] }), _jsx("span", { className: "piste" })] }));
}
