import { useEffect, useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { api } from "../api";
import type { Project } from "../types";
import FinancialSubNav from "../components/FinancialSubNav";
import ObraTotalForm from "../components/ObraTotalForm";

type Ctx = { projectId: number };

export default function FinancialSection() {
  const { projectId } = useOutletContext<Ctx>();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    api.projects
      .get(projectId)
      .then(setProject)
      .catch(() => setProject(null));
  }, [projectId]);

  return (
    <div>
      <ObraTotalForm projectId={projectId} project={project} onSaved={setProject} />
      <FinancialSubNav projectId={projectId} />
      <Outlet context={{ projectId }} />
    </div>
  );
}
