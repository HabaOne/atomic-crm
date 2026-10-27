import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Building2, Settings, User } from "lucide-react";
import { CanAccess, useTranslate } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { LocalesMenuButton } from "@/components/admin/locales-menu-button";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { useUserMenu } from "@/hooks/user-menu-context";

import { useConfigurationContext } from "../root/ConfigurationContext";

const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const translate = useTranslate();

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/board/*", location.pathname)) {
    currentPath = "/board";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else {
    currentPath = false;
  }

  return (
    <nav className="flex-grow">
      <header className="bg-secondary">
        <div className="px-4">
          <div className="flex justify-between items-center flex-1">
            <Link
              to="/"
              className="flex items-center gap-2 text-secondary-foreground no-underline"
            >
              <img
                className="[.light_&]:hidden h-6"
                src={darkModeLogo}
                alt={title}
              />
              <img
                className="[.dark_&]:hidden h-6"
                src={lightModeLogo}
                alt={title}
              />
              <h1 className="text-xl font-semibold">{title}</h1>
            </Link>
            <div>
              <nav className="flex">
                <NavigationTab
                  label={translate("crm.nav.dashboard")}
                  to="/"
                  isActive={currentPath === "/"}
                />
                <NavigationTab
                  label={translate("crm.nav.contacts")}
                  to="/contacts"
                  isActive={currentPath === "/contacts"}
                />
                <NavigationTab
                  label={translate("crm.nav.board")}
                  to="/board"
                  isActive={currentPath === "/board"}
                />
                <NavigationTab
                  label={translate("crm.nav.companies")}
                  to="/companies"
                  isActive={currentPath === "/companies"}
                />
                <NavigationTab
                  label={translate("crm.nav.deals")}
                  to="/deals"
                  isActive={currentPath === "/deals"}
                />
              </nav>
            </div>
            <div className="flex items-center">
              <LocalesMenuButton />
              <ThemeModeToggle />
              <RefreshButton />
              <UserMenu>
                <ConfigurationMenu />
                <CanAccess resource="sales" action="list">
                  <UsersMenu />
                  <OrganizationMenu />
                </CanAccess>
              </UserMenu>
            </div>
          </div>
        </div>
      </header>
    </nav>
  );
};

const NavigationTab = ({
  label,
  to,
  isActive,
}: {
  label: string;
  to: string;
  isActive: boolean;
}) => (
  <Link
    to={to}
    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? "text-secondary-foreground border-secondary-foreground"
        : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"
    }`}
  >
    {label}
  </Link>
);

const UsersMenu = () => {
  const { onClose } = useUserMenu() ?? {};
  const translate = useTranslate();
  return (
    <DropdownMenuItem asChild onClick={onClose}>
      <Link to="/sales" className="flex items-center gap-2">
        <User /> {translate("crm.nav.users")}
      </Link>
    </DropdownMenuItem>
  );
};

const OrganizationMenu = () => {
  const { onClose } = useUserMenu() ?? {};
  const translate = useTranslate();
  return (
    <DropdownMenuItem asChild onClick={onClose}>
      <Link to="/settings/organization" className="flex items-center gap-2">
        <Building2 /> {translate("crm.nav.organization")}
      </Link>
    </DropdownMenuItem>
  );
};

const ConfigurationMenu = () => {
  const { onClose } = useUserMenu() ?? {};
  const translate = useTranslate();
  return (
    <DropdownMenuItem asChild onClick={onClose}>
      <Link to="/settings" className="flex items-center gap-2">
        <Settings />
        {translate("crm.nav.my_info")}
      </Link>
    </DropdownMenuItem>
  );
};
export default Header;
