/** A project row. Its title is the title of its home page. */
export type Project = {
  id: string;
  homePageId: string;
  libraryRootId: string;
  createdAt: string;
  updatedAt: string;
};

/** A project with its title read from the home page. */
export type ProjectSummary = Project & { title: string };

/** Owner kind of a project's home page and library root. */
export const PROJECT_OWNER_KIND = "project";
