import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export const AppLayout = () => {
  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.mainContent}>
        <Outlet />
      </main>
    </div>
  );
};

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#090d16",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  mainContent: {
    flex: 1,
    overflowY: "auto",
    height: "100vh",
    boxSizing: "border-box",
  },
};
