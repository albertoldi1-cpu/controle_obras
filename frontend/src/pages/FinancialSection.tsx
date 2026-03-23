import { Outlet, useOutletContext } from "react-router-dom";
import FinancialSubNav from "../components/FinancialSubNav";

type Ctx = { projectId: number };

export default function FinancialSection() {
  const { projectId } = useOutletContext<Ctx>();
  return (
    <div>
      <FinancialSubNav projectId={projectId} />
      <Outlet context={{ projectId }} />
    </div>
  );
}
