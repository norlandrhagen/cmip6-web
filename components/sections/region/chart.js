import { Box, Spinner } from 'theme-ui'
import React, { useMemo, useState } from 'react'
import { format } from 'd3-format'
import {
  Chart,
  Circle,
  Grid,
  Line,
  Plot,
  Rect,
  TickLabels,
} from '@carbonplan/charts'
import { COLORMAP_COLORS, useDatasetsStore } from '../../datasets'

const getArrayData = (arr) => {
  const { sum, min, max } = arr.reduce(
    (accum, el) => {
      return {
        sum: accum.sum + el,
        min: Math.min(el, accum.min),
        max: Math.max(el, accum.max),
      }
    },
    { sum: 0, min: Infinity, max: -Infinity }
  )
  return { avg: sum / arr.length, min, max }
}

// TODO: add units
export const formatValue = (value) => {
  let result
  if (value === 0) {
    result = 0
  } else if (value < 0.0001) {
    result = format('.0e')(value)
  } else if (value < 0.01) {
    result = format('.2')(value)
  } else if (value < 1) {
    result = format('.2f')(value)
  } else if (value < 10) {
    result = format('.1f')(value)
  } else if (value < 10000) {
    result = format('.0f')(value)
  } else {
    result = format('0.2s')(value)
  }

  return (
    <Box as='span' sx={{ whiteSpace: 'nowrap' }}>
      {result}
    </Box>
  )
}

const LoadingSpinner = ({ opacity = 1 }) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: '25%',
        left: '35px',
        right: 0,
        zIndex: 1,
        width: '28px',
        mx: 'auto',
        opacity: opacity,
        transition: 'opacity 0.05s',
      }}
    >
      <Spinner sx={{ color: 'secondary' }} duration={750} size={28} />
    </Box>
  )
}

const ChartWrapper = ({ data }) => {
  const [hovered, setHovered] = useState(null)
  const activeDataset = useDatasetsStore((state) => state.active)
  const hoveredDataset = useDatasetsStore((state) => state.hovered)
  const datasets = useDatasetsStore((state) => state.datasets)
  const variable = useDatasetsStore((state) => state.filters.variable)
  const display = useDatasetsStore((state) => state.displayTime)
  const setDisplay = useDatasetsStore((state) => state.setDisplayTime)

  // By default, use active dataset as primary dataset (reference for dateStrings and timescale)
  let primaryDataset = datasets[activeDataset]
  if (!primaryDataset) {
    // But fallback to first selected dataset if none is active
    const selectedName = Object.keys(datasets).find(
      (key) => datasets[key].selected
    )
    primaryDataset = datasets[selectedName]
  }

  const dateStrings = primaryDataset?.dateStrings
  const timescale = primaryDataset?.timescale

  const { timeRange, ticks, bands } = useMemo(() => {
    if (!dateStrings) {
      return {}
    }
    const fullRange = dateStrings.getDisplayRange(display)
    const bands = fullRange.map((d, i) => ({
      time: d,
      x0: i === 0 ? d : (fullRange[i - 1] + d) / 2,
      x1: i === fullRange.length - 1 ? d : (d + fullRange[i + 1]) / 2,
    }))

    return {
      timeRange: [fullRange[0], fullRange[fullRange.length - 1]],
      ticks: dateStrings.getTicks(display),
      bands,
    }
  }, [dateStrings, display])

  // We cannot render domain before dateStrings have been loaded, so return generic loading text
  if (!datasets || !dateStrings) {
    return (
      <Box
        sx={{
          width: '100%',
          height: ['200px', '200px', '125px', '200px'],
          position: 'relative',
        }}
      >
        <LoadingSpinner />
      </Box>
    )
  }

  let circle
  const range = [Infinity, -Infinity]

  const lines = data
    .filter(([name, value]) => value && datasets[name].selected)
    .map(([name, value]) => {
      const lineData = Object.keys(value)
        .map((time) => {
          const { avg, min, max } = getArrayData(value[time])
          range[0] = Math.min(range[0], min)
          range[1] = Math.max(range[1], max)

          const activeTime = dateStrings.valuesToTime(
            datasets[name].dateStrings.timeToValues(Number(time))
          )

          if (name === activeDataset && hovered === activeTime) {
            circle = [activeTime, avg]
          }

          return [activeTime, avg]
        })
        .filter((p) => typeof p[0] === 'number')

      let color = 'secondary'
      let width = 1.5
      const activeColor = COLORMAP_COLORS[datasets[name].colormapName]

      if (name === activeDataset) {
        color = activeColor
        width = 2
      } else if (name === hoveredDataset) {
        color = 'primary'
        width = 2
      }
      return {
        key: name,
        circle,
        color,
        width,
        lineData,
      }
    }, [])

  const loading = data.some(([name, value]) => !value)
  const units = (
    <Box as='span' sx={{ textTransform: 'none' }}>
      {variable === 'pr' ? 'mm' : 'K'}
    </Box>
  )

  return (
    <Box
      sx={{
        width: '100%',
        height: ['200px', '200px', '125px', '200px'],
        position: 'relative',
      }}
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      <LoadingSpinner opacity={loading ? 1 : 0} />
      <Chart
        x={timeRange}
        y={range}
        padding={{ left: 35, right: 0, top: 0, bottom: 25 }}
      >
        <Grid horizontal />
        <Grid vertical values={timescale === 'day' ? undefined : ticks} />
        <TickLabels left count={4} format={formatValue} />
        <TickLabels
          bottom
          values={timescale === 'day' ? undefined : ticks}
          format={(d) => dateStrings.formatTick(Math.round(d))}
        />
        {typeof hovered === 'number' && circle && (
          <Box
            sx={{
              position: 'absolute',
              right: 0,
              top: 0,
              mt: 0,
            }}
          >
            <Box
              sx={{
                fontFamily: 'mono',
                letterSpacing: 'mono',
                textTransform: 'uppercase',
                fontSize: [1, 1, 1, 2],
                color: 'secondary',
              }}
            >
              ({dateStrings.formatTick(circle[0])}, {formatValue(circle[1])}
              {units})
            </Box>
          </Box>
        )}

        <Plot>
          {!loading &&
            lines
              .sort((a, b) => {
                const [aWeight, bWeight] = [a, b].map(({ key }) => {
                  if (key === hoveredDataset) {
                    return 2
                  } else if (key === activeDataset) {
                    return 1
                  } else {
                    return 0
                  }
                })

                return aWeight - bWeight
              })
              .map(({ key, circle, color, width, lineData }) => (
                <Box as='g' key={key}>
                  <Line
                    color={color}
                    data={lineData}
                    width={width}
                    sx={{ transition: 'all 0.2s' }}
                  />
                  {circle && (
                    <Circle
                      x={circle[0]}
                      y={circle[1]}
                      color={color}
                      size={15}
                    />
                  )}
                </Box>
              ))}
          {bands.map(({ time, x0, x1 }) => (
            <Rect
              key={time}
              x={[x0, x1]}
              y={range}
              color='transparent'
              onMouseEnter={() => setHovered(time)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setDisplay(dateStrings.timeToValues(time))}
            />
          ))}
        </Plot>
      </Chart>
    </Box>
  )
}

export default ChartWrapper
