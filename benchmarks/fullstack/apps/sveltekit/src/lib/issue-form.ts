/** Raw values of the new-issue form, echoed back after a failed submission. */
export interface IssueFormValues {
  title: string;
  body: string;
  project: string;
  priority: string;
  labels: string[];
}

export const EMPTY_ISSUE_FORM: IssueFormValues = {
  title: "",
  body: "",
  project: "",
  priority: "medium",
  labels: [],
};
