import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ThumbnailField, VideoField } from '../components/upload/FileFields';
import { useApiHealth } from '../hooks/useApiHealth';
import { ApiError, api } from '../lib/api';
import { uploadFile, type UploadProgress } from '../lib/upload';
import { thumbnailRule, videoRule } from '../lib/validation';
import type { Project } from '../types/project';

type Stage = 'idle' | 'creating' | 'video' | 'thumbnail' | 'finishing';

const STAGE_LABEL: Record<Stage, string> = {
  idle: 'Create project',
  creating: 'Creating project…',
  video: 'Uploading video…',
  thumbnail: 'Uploading thumbnail…',
  finishing: 'Finalising…',
};

export function NewVideoPage() {
  const navigate = useNavigate();
  const { limits, error: healthError } = useApiHealth();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [videoProgress, setVideoProgress] = useState<UploadProgress | null>(null);
  const [thumbnailProgress, setThumbnailProgress] = useState<UploadProgress | null>(null);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const submitting = useRef(false);
  const isBusy = stage !== 'idle';

  const vRule = videoRule(limits);
  const tRule = thumbnailRule(limits);

  const handleSubmit = async () => {
    // Ref guard: blocks double clicks and rapid resubmission.
    if (submitting.current || !videoFile || !thumbnailFile) return;
    submitting.current = true;
    setSubmitError(null);

    try {
      let project = createdProject;
      if (!project) {
        setStage('creating');
        project = await api.createProject();
        setCreatedProject(project);
      }

      setStage('video');
      await uploadFile(`/projects/${project.id}/video`, videoFile, setVideoProgress);

      setStage('thumbnail');
      await uploadFile(`/projects/${project.id}/thumbnail`, thumbnailFile, setThumbnailProgress);

      setStage('finishing');
      navigate(`/projects/${project.id}?created=1`);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error : new ApiError('Upload failed unexpectedly.', 0, 'UNKNOWN_ERROR'),
      );
      setStage('idle');
    } finally {
      submitting.current = false;
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    setThumbnailFile(null);
    setSubmitError(null);
    setVideoProgress(null);
    setThumbnailProgress(null);
    setCreatedProject(null);
    setStage('idle');
  };

  const canSubmit = Boolean(videoFile && thumbnailFile) && !isBusy;


  return (
    <>
      <PageHeader
        title="New Video"
        description="Upload the exported MP4 and your YouTube thumbnail. Files stay on this computer."
        action={
          <Button variant="secondary" onClick={handleReset} disabled={isBusy || (!videoFile && !thumbnailFile)}>
            Clear form
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {healthError?.isBackendUnavailable && (
            <Alert tone="error" title="The local backend is not reachable">
              Start the server with <code className="font-mono">npm run dev</code>, then reload this page.
            </Alert>
          )}

          {submitError && (
            <Alert
              tone="error"
              title="Upload failed"
              action={
                <Button size="sm" variant="secondary" onClick={handleReset}>
                  Start over
                </Button>
              }
            >
              {submitError.message}
              {createdProject && (
                <p className="mt-2">
                  A draft project was created.{' '}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => navigate(`/projects/${createdProject.id}`)}
                  >
                    Open it
                  </button>{' '}
                  to see what was stored.
                </p>
              )}
            </Alert>
          )}

          <Card>
            <CardHeader title="1. Video file" description="Exported from CapCut as MP4." />
            <div className="p-5">
              <VideoField
                id="video-file"
                label="MP4 video"
                hint={vRule.hint}
                accept={vRule.extensions.join(',')}
                rule={vRule}
                file={videoFile}
                disabled={isBusy}
                error={null}
                onSelect={setVideoFile}
                onClear={() => {
                  setVideoFile(null);
                  setVideoProgress(null);
                }}
              />
              {stage === 'video' && videoProgress && (
                <div className="mt-4">
                  <ProgressBar percent={videoProgress.percent} label="Uploading video" />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="2. Thumbnail" description="The custom thumbnail shown on YouTube." />
            <div className="p-5">
              <ThumbnailField
                id="thumbnail-file"
                label="Thumbnail image"
                hint={tRule.hint}
                accept={tRule.extensions.join(',')}
                rule={tRule}
                file={thumbnailFile}
                disabled={isBusy}
                error={null}
                onSelect={setThumbnailFile}
                onClear={() => {
                  setThumbnailFile(null);
                  setThumbnailProgress(null);
                }}
              />
              {stage === 'thumbnail' && thumbnailProgress && (
                <div className="mt-4">
                  <ProgressBar percent={thumbnailProgress.percent} label="Uploading thumbnail" />
                </div>
              )}
            </div>
          </Card>
        </div>

        <SummaryCard
          hasVideo={Boolean(videoFile)}
          hasThumbnail={Boolean(thumbnailFile)}
          isBusy={isBusy}
          stage={stage}
          canSubmit={canSubmit}
          onSubmit={handleSubmit}
        />
      </div>
    </>
  );
}

function SummaryCard({
  hasVideo,
  hasThumbnail,
  isBusy,
  stage,
  canSubmit,
  onSubmit,
}: {
  hasVideo: boolean;
  hasThumbnail: boolean;
  isBusy: boolean;
  stage: Stage;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <CardHeader title="3. Create project" />
      <div className="space-y-4 p-5">
        <ul className="space-y-2 text-sm text-zinc-400">
          <ChecklistItem done={hasVideo} label="Video file selected" />
          <ChecklistItem done={hasThumbnail} label="Thumbnail selected" />
          <ChecklistItem done={isBusy} label="Stored on this computer" />
        </ul>

        <Button className="w-full" onClick={onSubmit} disabled={!canSubmit} isLoading={isBusy}>
          {STAGE_LABEL[stage]}
        </Button>

        <p className="text-xs text-zinc-500">
          Nothing is analysed, generated or published in this phase. The files are simply stored locally.
        </p>
      </div>
    </Card>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
          done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-600'
        }`}
        aria-hidden="true"
      >
        ✓
      </span>
      <span className={done ? 'text-zinc-200' : ''}>{label}</span>
    </li>
  );
}
