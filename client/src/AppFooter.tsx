import './AppFooter.css';
import { BrandLogo } from './BrandLogo';

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__brand">
          <BrandLogo variant="wordmark" className="app-footer__logo" decorative />
          <span className="app-footer__copyright">© 2026 @HandsUpBilly</span>
        </div>
        <div className="app-footer__legal">
          <p>Turn 16 is an unofficial independent training tool.</p>
          <p>
            Not affiliated with or endorsed by Games Workshop.
            <span>Blood Bowl and related intellectual property belong to their respective owners.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
