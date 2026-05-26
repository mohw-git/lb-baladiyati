import { useIsFieldWorker } from '../../lib/hooks/usePermission';
import { CitizenHome } from '../../components/home/CitizenHome';
import { WorkerHome } from '../../components/home/WorkerHome';

export default function HomeScreen() {
  const isFieldWorker = useIsFieldWorker();
  return isFieldWorker ? <WorkerHome /> : <CitizenHome />;
}
