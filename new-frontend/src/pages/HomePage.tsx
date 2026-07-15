import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined'
import ContentPasteOutlinedIcon from '@mui/icons-material/ContentPasteOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import {
  Box,
  ButtonBase,
  Stack,
  Typography,
} from '@mui/material'
import { ChangeEvent, useRef } from 'react'

type HomePageProps = {
  onCreateBlankProject: () => void
  onPasteTextProject: () => void
  onUploadPdfProject: (file: File) => void
}

const actions = [
  {
    description: 'Start from text already copied to your clipboard.',
    icon: <ContentPasteOutlinedIcon />,
    key: 'paste',
    label: 'Paste text from clipboard',
  },
  {
    description: 'Import a PDF as the source for a new editing project.',
    icon: <PictureAsPdfOutlinedIcon />,
    key: 'pdf',
    label: 'Upload PDF',
  },
  {
    description: 'Open an empty editor and add sentences manually.',
    icon: <AddCircleOutlineOutlinedIcon />,
    key: 'blank',
    label: 'Create new from scratch',
  },
] as const

export function HomePage({
  onCreateBlankProject,
  onPasteTextProject,
  onUploadPdfProject,
}: HomePageProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const handlePdfChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (file) {
      onUploadPdfProject(file)
    }
  }

  const handleAction = (key: (typeof actions)[number]['key']) => {
    if (key === 'paste') {
      onPasteTextProject()
      return
    }

    if (key === 'pdf') {
      pdfInputRef.current?.click()
      return
    }

    onCreateBlankProject()
  }

  return (
    <Box
      sx={{
        alignItems: 'center',
        bgcolor: '#f4f6fa',
        display: 'flex',
        minHeight: '100vh',
        px: { xs: 2, md: 4 },
        py: { xs: 4, md: 6 },
      }}
    >
      <Stack
        spacing={4}
        sx={{
          justifyContent: 'center',
          minHeight: { xs: 'auto', md: 'calc(100vh - 96px)' },
          mx: 'auto',
          width: 'min(100%, 980px)',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography component="h1" sx={{ fontSize: { xs: 32, md: 44 }, fontWeight: 800, lineHeight: 1.1 }}>
            Start a new attestation editing project
          </Typography>
          <Typography color="text.secondary" sx={{ mx: 'auto', mt: 1.5, maxWidth: 620 }}>
            Choose the source for the first set of attestations you want to edit.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {actions.map((action) => (
            <ButtonBase
              focusRipple
              key={action.key}
              onClick={() => handleAction(action.key)}
              sx={{
                alignItems: 'stretch',
                bgcolor: '#ffffff',
                border: '1px solid #dde3ee',
                borderRadius: 2,
                boxShadow: '0 16px 40px rgba(33, 42, 66, 0.07)',
                display: 'flex',
                justifyContent: 'flex-start',
                minHeight: 210,
                p: 3,
                textAlign: 'left',
                transition: 'border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease',
                '&:hover': {
                  borderColor: '#2457c5',
                  boxShadow: '0 18px 44px rgba(33, 42, 66, 0.11)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Stack spacing={2.5} sx={{ width: '100%' }}>
                <Box
                  sx={{
                    alignItems: 'center',
                    bgcolor: '#eef3ff',
                    borderRadius: 2,
                    color: '#2457c5',
                    display: 'flex',
                    height: 48,
                    justifyContent: 'center',
                    width: 48,
                    '& svg': {
                      fontSize: 28,
                    },
                  }}
                >
                  {action.icon}
                </Box>
                <Box>
                  <Typography component="h2" sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25 }}>
                    {action.label}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {action.description}
                  </Typography>
                </Box>
              </Stack>
            </ButtonBase>
          ))}
        </Box>
      </Stack>

      <input
        accept="application/pdf,.pdf"
        hidden
        onChange={handlePdfChange}
        ref={pdfInputRef}
        type="file"
      />
    </Box>
  )
}
