import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Dropdown, Toast } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { signOut } from "../../api/auth";
import { useAuth } from "../../hooks";

const initials = (user) =>
  (user.name || user.email || "?").trim().charAt(0).toUpperCase();

/**
 * Avatar menu showing who is signed in, with the way out.
 *
 * Renders nothing when signed out so it can sit unconditionally in headers that
 * are also reachable by anonymous visitors.
 */
export default function UserButton({ size = "small" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const leave = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // A full navigation clears the editor state that belonged to the session,
      // so the next account never sees the previous one's diagram on screen.
      window.location.assign("/sign-in");
    } catch (error) {
      setSigningOut(false);
      Toast.error(error?.message || t("oops_smth_went_wrong"));
    }
  };

  return (
    <Dropdown
      trigger="click"
      position="bottomRight"
      render={
        <Dropdown.Menu>
          <Dropdown.Title>{user.email}</Dropdown.Title>
          <Dropdown.Item
            icon={<i className="bi bi-collection" />}
            onClick={() => navigate("/collection")}
          >
            {t("your_diagrams")}
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item
            type="danger"
            icon={<i className="bi bi-box-arrow-right" />}
            disabled={signingOut}
            onClick={leave}
          >
            {t("sign_out")}
          </Dropdown.Item>
        </Dropdown.Menu>
      }
    >
      <Avatar
        size={size}
        color="light-blue"
        alt={user.name || user.email}
        className="cursor-pointer select-none"
      >
        {initials(user)}
      </Avatar>
    </Dropdown>
  );
}
