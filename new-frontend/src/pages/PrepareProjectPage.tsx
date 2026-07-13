import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined'
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined'
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined'
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { KeyboardEvent, useState } from 'react'
import { commodityOptions } from '../assets/commodities'

type PrepareProjectPageProps = {
  commodities: string[]
  isLoading: boolean
  sourceLabel: string
  text: string
  onBack: () => void
  onCommoditiesChange: (commodities: string[]) => void
  onContinue: () => void
  onIdentifyCommodities: () => void
  onTextChange: (text: string) => void
}

export function PrepareProjectPage({
  commodities,
  isLoading,
  sourceLabel,
  text,
  onBack,
  onCommoditiesChange,
  onContinue,
  onIdentifyCommodities,
  onTextChange,
}: PrepareProjectPageProps) {
  const [commodityInput, setCommodityInput] = useState('')

  const addCommodity = (value = commodityInput) => {
    const nextCommodity = value.trim()

    if (!nextCommodity || commodities.includes(nextCommodity)) {
      setCommodityInput('')
      return
    }

    onCommoditiesChange([...commodities, nextCommodity])
    setCommodityInput('')
  }

  const handleCommodityKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addCommodity()
    }
  }

  const removeCommodity = (commodity: string) => {
    onCommoditiesChange(commodities.filter((item) => item !== commodity))
  }

  return (
    <Box
      sx={{
        bgcolor: '#f4f6fa',
        minHeight: '100vh',
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 5 },
      }}
    >
      <Stack spacing={3} sx={{ mx: 'auto', width: 'min(100%, 1120px)' }}>
        <Stack alignItems="center" direction="row" spacing={1}>
          <Tooltip title="Back">
            <IconButton aria-label="Back" onClick={onBack}>
              <ArrowBackOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1 }}>
            <Typography color="text.secondary" sx={{ fontSize: 13, fontWeight: 700 }}>
              {sourceLabel}
            </Typography>
            <Typography component="h1" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 800, lineHeight: 1.15 }}>
              Review text and commodities
            </Typography>
          </Box>
          <Button
            disabled={!text.trim() || isLoading}
            endIcon={<ArrowForwardOutlinedIcon />}
            onClick={onContinue}
            variant="contained"
          >
            Continue to editor
          </Button>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
          }}
        >
          <Box
            sx={{
              bgcolor: '#ffffff',
              border: '1px solid #dde3ee',
              borderRadius: 2,
              boxShadow: '0 16px 40px rgba(33, 42, 66, 0.07)',
              p: { xs: 2, md: 3 },
            }}
          >
            <TextField
              disabled={isLoading}
              fullWidth
              label="Source text"
              minRows={20}
              multiline
              onChange={(event) => onTextChange(event.target.value)}
              placeholder="Paste or edit the source text before creating units."
              value={text}
            />
          </Box>

          <Box
            sx={{
              bgcolor: '#ffffff',
              border: '1px solid #dde3ee',
              borderRadius: 2,
              boxShadow: '0 16px 40px rgba(33, 42, 66, 0.07)',
              p: { xs: 2, md: 3 },
            }}
          >
            <Stack spacing={2.5}>
              <Box>
                <Typography component="h2" sx={{ fontSize: 20, fontWeight: 800 }}>
                  Related commodities
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Review detected commodities or add your own before editing.
                </Typography>
              </Box>

              <Button
                disabled={!text.trim() || isLoading}
                onClick={onIdentifyCommodities}
                startIcon={isLoading ? <CircularProgress color="inherit" size={16} /> : <AutoFixHighOutlinedIcon />}
                variant="outlined"
              >
                Identify commodities
              </Button>

              <Stack direction="row" flexWrap="wrap" gap={1}>
                {commodities.length === 0 ? (
                  <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                    No commodities selected yet.
                  </Typography>
                ) : (
                  commodities.map((commodity) => (
                    <Chip
                      key={commodity}
                      label={commodity}
                      onDelete={() => removeCommodity(commodity)}
                      variant="outlined"
                    />
                  ))
                )}
              </Stack>

              <Stack direction="row" spacing={1}>
                <Autocomplete
                  disabled={isLoading}
                  freeSolo
                  fullWidth
                  inputValue={commodityInput}
                  onChange={(_, value) => {
                    if (typeof value === 'string') {
                      addCommodity(value)
                    }
                  }}
                  onInputChange={(_, value) => setCommodityInput(value)}
                  options={commodityOptions.filter((commodity) => !commodities.includes(commodity))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Add commodity"
                      onKeyDown={handleCommodityKeyDown}
                      size="small"
                    />
                  )}
                  size="small"
                />
                <Tooltip title="Add commodity">
                  <span>
                    <IconButton
                      aria-label="Add commodity"
                      disabled={isLoading || !commodityInput.trim()}
                      onClick={() => addCommodity()}
                    >
                      <AddOutlinedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Stack>
    </Box>
  )
}
