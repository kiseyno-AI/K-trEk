import ActivityExplorer from './activity-explorer';
import { listActivities } from '../lib/activity-store';
import { getTripOrigin } from '../lib/trip-origin-store';
import { headers } from 'next/headers';
import { localTripVoiceAvailable } from '../lib/trip-voice-scope';

export const dynamic = 'force-dynamic';

export default async function Home() {
  return (
    <ActivityExplorer
      activities={await listActivities()}
      origin={getTripOrigin()}
      voiceEnabled={localTripVoiceAvailable(await headers())}
    />
  );
}
