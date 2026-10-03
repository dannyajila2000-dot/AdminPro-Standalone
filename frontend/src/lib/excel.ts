import ExcelJS from 'exceljs'

const COLOR_ENCABEZADO = 'FF0284C7'
const COLOR_TEXTO_ENCABEZADO = 'FFFFFFFF'
const COLOR_BANDA = 'FFF8FAFC'
const COLOR_BORDE = 'FFE2E8F0'

function formatearEncabezado(clave: string) {
  const conEspacios = clave.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1)
}

export async function exportarExcel(
  nombreArchivo: string,
  filas: Record<string, unknown>[],
  hoja = 'Datos',
) {
  if (filas.length === 0) return

  const columnas = Object.keys(filas[0])

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(hoja, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  worksheet.columns = columnas.map((columna) => ({
    header: formatearEncabezado(columna),
    key: columna,
  }))
  filas.forEach((fila) => worksheet.addRow(fila))

  const encabezado = worksheet.getRow(1)
  encabezado.height = 22
  encabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: COLOR_TEXTO_ENCABEZADO } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO } }
    celda.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  columnas.forEach((columna, i) => {
    const col = worksheet.getColumn(i + 1)
    let anchoMaximo = formatearEncabezado(columna).length
    col.eachCell({ includeEmpty: false }, (celda, numeroFila) => {
      if (numeroFila === 1) return
      anchoMaximo = Math.max(anchoMaximo, String(celda.value ?? '').length)
      if (typeof celda.value === 'number') {
        celda.alignment = { horizontal: 'right' }
      }
    })
    col.width = Math.min(Math.max(anchoMaximo + 2, 10), 40)
  })

  for (let numeroFila = 2; numeroFila <= worksheet.rowCount; numeroFila++) {
    const esBanda = numeroFila % 2 === 0
    worksheet.getRow(numeroFila).eachCell({ includeEmpty: true }, (celda) => {
      if (esBanda) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BANDA } }
      }
      celda.border = {
        top: { style: 'hair', color: { argb: COLOR_BORDE } },
        bottom: { style: 'hair', color: { argb: COLOR_BORDE } },
        left: { style: 'hair', color: { argb: COLOR_BORDE } },
        right: { style: 'hair', color: { argb: COLOR_BORDE } },
      }
    })
  }

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnas.length },
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${nombreArchivo.replace(/\.(csv|xlsx)$/i, '')}.xlsx`
  enlace.click()
  URL.revokeObjectURL(url)
}
