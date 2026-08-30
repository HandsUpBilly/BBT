import './AppFooter.css';
import { BrandLogo } from './BrandLogo';

export function AppFooter() {
  return (
    <footer className="app-footer">
      <BrandLogo variant="wordmark" className="app-footer__logo" decorative />
      <span>© 2026 @HandsUpBilly</span>
      <span>Turn 16 is an unofficial independent training tool.</span>
      <span>Not affiliated with or endorsed by Games Workshop.</span>
      <span>Blood Bowl and related intellectual property belong to their respective owners.</span>
    </footer>
  );
}
