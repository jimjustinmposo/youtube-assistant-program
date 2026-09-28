import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="That route does not exist in this application." />
      <Link to="/">
        <Button variant="secondary">Back to dashboard</Button>
      </Link>
    </>
  );
}
