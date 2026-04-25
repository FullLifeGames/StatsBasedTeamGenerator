import {ControlRail} from './components/ControlRail';
import {InsightPanel} from './components/InsightPanel';
import {TeamBoard} from './components/TeamBoard';
import {useGenerator} from './data/useGenerator';

export function App() {
  const generator = useGenerator();

  return (
    <main className="app-shell">
      {generator.error ? (
        <div className="error-banner" role="alert">
          {generator.error}
        </div>
      ) : null}

      <div className="app-layout">
        <ControlRail {...generator} />
        <TeamBoard team={generator.team} onReplace={generator.replaceMember} onToggleLock={generator.toggleLock} />
        <InsightPanel team={generator.team} />
      </div>
    </main>
  );
}
