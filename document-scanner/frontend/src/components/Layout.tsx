import { ReactNode } from "react";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  return (
    <div className="layout-root">
      <header className="layout-header">
        <h1>Document Scanner</h1>
        <p>Privacy-first mobile web document scanner with real-time guidance</p>
      </header>
      <main className="layout-main">{children}</main>
    </div>
  );
}
