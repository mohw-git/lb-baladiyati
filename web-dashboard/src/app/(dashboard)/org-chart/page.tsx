import { redirect } from 'next/navigation';

/** Legacy route — org chart replaced by Departments Overview. */
export default function OrgChartRedirectPage() {
  redirect('/departments?tab=overview');
}
