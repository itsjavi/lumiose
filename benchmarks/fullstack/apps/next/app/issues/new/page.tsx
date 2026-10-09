import { listLabels, listProjects } from "@bench/data";
import { PageTitle } from "@bench/react-ui";
import type { Metadata } from "next";
import { NewIssueForm } from "./new-issue-form";

export const metadata: Metadata = { title: "New issue · Tracker" };

export default function NewIssuePage() {
  return (
    <>
      <PageTitle>New issue</PageTitle>
      <NewIssueForm projects={listProjects()} labels={listLabels()} />
    </>
  );
}
