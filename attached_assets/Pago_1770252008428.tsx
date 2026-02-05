import {
    Button,
    TextField,
    Paper,
    Container,
    Typography,
    Box,
    CircularProgress,
    Stack,
    Alert,
    RadioGroup,
    FormControlLabel,
    Radio,
    Chip,
  } from '@mui/material';
  import { styled } from '@mui/material/styles';
  import { useState, useEffect } from 'react';
  import { useLocation, useSearchParams } from 'react-router-dom';
  import axios from 'axios';
  import CheckCircleIcon from '@mui/icons-material/CheckCircle';
  import ErrorIcon from '@mui/icons-material/Error';
  import PaymentIcon from '@mui/icons-material/Payment';
  import { parsePhoneNumber, isValidPhoneNumber } from 'react-phone-number-input'
  // Styled components
  const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(4),
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(6),
    },
  }));
  
  interface PaymentFormData {
    email: string;
    phoneNumber: string;
  }
  
  interface ValidationResult {
    REQ_id_pago: string;
    REQ_multas: any[];
    REQ_monto_multas: number;
    REQ_libre_de_multas: boolean;
    REQ_soap_aprobado: boolean;
    REQ_rt_aprobado: boolean;
    REQ_modalidades_de_pago: {
      REQ_cuota_1: boolean;
      REQ_cuota_2: boolean;
      REQ_total: boolean;
    };
    REQ_monto_cuota_1: number;
    REQ_monto_cuota_1_final: number;
    REQ_monto_cuota_2: number;
    REQ_monto_cuota_2_final: number;
    REQ_monto_final: number;
    REQ_monto_pc: number;
    REQ_not_found: boolean;
    REQ_ppu: string;
    REQ_error: boolean;
    REQ_razon_rechazo: string
  }
  
  export default function PaymentPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<PaymentFormData>({
      email: '',
      phoneNumber: '',
    });
    const [formErrors, setFormErrors] = useState<Partial<PaymentFormData>>({});
    const [paymentMethod, setPaymentMethod] = useState<string>('');
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const validationResult = location.state?.report_results as ValidationResult;
    const token = searchParams.get('token');
    const [paymentStatus, setPaymentStatus] = useState<'success' | 'error' | null>(null);
  
    useEffect(() => {
      const checkPaymentStatus = async () => {
        // Check if we're returning from payment
        if (location.pathname === '/pago' && token) {
          console.log("Processing payment confirmation with token:", token);
          try {
            const response = await axios.post('/api/payment/confirm', { token });
            console.log("Payment confirmation response:", response.data);
            
            if (response.data.message === 'Payment confirmed successfully') {
              setPaymentStatus('success');
            } else {
              setPaymentStatus('error');
              setError('El pago no pudo ser confirmado');
            }
          } catch (err) {
            console.error("Payment confirmation error:", err);
            setPaymentStatus('error');
            setError('Error al verificar el estado del pago');
          }
        }
      };
  
      checkPaymentStatus();
    }, [location, token]);
  
    const validateForm = (): boolean => {
      const errors: Partial<PaymentFormData> = {};
  
      // Email validation
      if (!formData.email) {
        errors.email = 'El email es requerido';
      } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
        errors.email = 'Email inválido';
      }
  
      // Phone validation using react-phone-number-input
      if (!formData.phoneNumber) {
        errors.phoneNumber = 'El número de teléfono es requerido';
      } else {
        const phoneNumber = parsePhoneNumber(formData.phoneNumber);
        if (!isValidPhoneNumber(formData.phoneNumber) || !phoneNumber || phoneNumber.country !== 'CL') {
          errors.phoneNumber = 'Ingrese un número de teléfono chileno válido (ej: +56912345678)';
        }
      }
  
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    };
  
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      // Clear error when user types
      if (formErrors[name as keyof PaymentFormData]) {
        setFormErrors((prev) => ({
          ...prev,
          [name]: undefined,
        }));
      }
    };
  
    const getPaymentAmount = () => {
      if (!validationResult || !paymentMethod) return 0;
      
      switch (paymentMethod) {
        case 'cuota_1':
          return validationResult.REQ_monto_cuota_1_final;
        case 'cuota_2':
          return validationResult.REQ_monto_cuota_2_final;
        case 'total':
          return validationResult.REQ_monto_final;
        default:
          return 0;
      }
    };
  
    const getCostBreakdown = () => {
      if (!validationResult || !paymentMethod) return null;

      const breakdown = {
        base: 0,
        multas: validationResult.REQ_monto_multas || 0,
        total: 0
      };

      switch (paymentMethod) {
        case 'cuota_1':
          breakdown.base = validationResult.REQ_monto_cuota_1;
          breakdown.total = validationResult.REQ_monto_cuota_1_final;
          break;
        case 'cuota_2':
          breakdown.base = validationResult.REQ_monto_cuota_2;
          breakdown.total = validationResult.REQ_monto_cuota_2_final;
          break;
        case 'total':
          breakdown.base = validationResult.REQ_monto_pc;
          breakdown.total = validationResult.REQ_monto_final;
          break;
      }

      return breakdown;
    };
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
  
      if (!validateForm() || !paymentMethod) {
        return;
      }
  
      try {
        setLoading(true);
        setError(null);
  
        const { data } = await axios.post('/api/payment/create', {
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          amount: getPaymentAmount(),
          id_pago: validationResult.REQ_id_pago,
          modalidad_pago: paymentMethod,
          //optional: validationResult,
        });
  
        window.location.href = data.redirectUrl;
      } catch (err) {
        setError('Hubo un error al procesar tu pago. Por favor intenta de nuevo.');
        console.error('Payment error:', err);
      } finally {
        setLoading(false);
      }
    };
  
    if (paymentStatus) {
      return (
        <Container maxWidth="sm">
          <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
            <StyledPaper elevation={3}>
              <Stack spacing={3} alignItems="center">
                {paymentStatus === 'error' ? (
                  <>
                    <ErrorIcon color="error" sx={{ fontSize: 60 }} />
                    <Typography variant="h5" align="center">
                      Error en el Pago
                    </Typography>
                    <Typography color="error" align="center">
                      {error}
                    </Typography>
                    <Button 
                      variant="contained" 
                      onClick={() => window.location.href = '/portal'}
                    >
                      Volver al inicio
                    </Button>
                  </>
                ) : (
                  <>
                    <CheckCircleIcon color="success" sx={{ fontSize: 60 }} />
                    <Typography variant="h5" align="center">
                      ¡Pago Exitoso!
                    </Typography>
                    <Typography align="center">
                      Tu pago ha sido procesado correctamente.
                    </Typography>
                    <Button 
                      variant="contained" 
                      onClick={() => window.location.href = '/portal'}
                    >
                      Volver al inicio
                    </Button>
                  </>
                )}
              </Stack>
            </StyledPaper>
          </Box>
        </Container>
      );
    }
  
    return (
      <Container maxWidth="sm" sx={{ minHeight: '100vh' }}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            py: 4,
          }}
        >
          <StyledPaper elevation={3}>
            <Typography
              variant="h4"
              component="h1"
              align="center"
              gutterBottom
              sx={{ mb: 4 }}
            >
              Pagar permiso de circulación
            </Typography>
            <Typography     
              variant="h5"
              component="h1"
              align="center"
              gutterBottom
              sx={{ mb: 4 }}>
              {validationResult.REQ_ppu}
            </Typography>
  
            {validationResult && (
              <Stack spacing={3} sx={{ mb: 4 }}>
                  <>
                    <Box>
                      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                        <Chip
                          icon={<PaymentIcon />}
                          label={validationResult.REQ_libre_de_multas ? 'Sin multas' : `Multas: $${validationResult.REQ_monto_multas.toLocaleString()}`}
                          color={ validationResult.REQ_libre_de_multas === null ? 'default' : validationResult.REQ_libre_de_multas ? 'success' : 'error'}
                        />
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="Revisión Técnica"
                          color={ validationResult.REQ_rt_aprobado === null ? 'default' : validationResult.REQ_rt_aprobado ? 'success' : 'error'}
                        />
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="SOAP"
                          color={ validationResult.REQ_soap_aprobado === null ? 'default' : validationResult.REQ_soap_aprobado ? 'success' : 'error'}
                        />
                      </Stack>
                    </Box>
                    

                    {validationResult.REQ_error ? (
                      <>
                          <Alert severity="error" sx={{ mt: 2 }}>
                            <Typography variant="subtitle1" gutterBottom>
                              No se puede procesar el pago
                            </Typography>
                            <Typography variant="body2">
                              {validationResult.REQ_razon_rechazo}
                            </Typography>
                          </Alert>
                          <Box sx={{ mt: 2 }}>
                          <Button 
                            variant="contained" 
                            onClick={() => window.location.href = '/portal'}
                            size="small"
                          >
                            Volver al inicio
                          </Button>
                        </Box>
                      </>
                        ) : (
                      <>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Modalidad de Pago
                          </Typography>
                          <RadioGroup
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                          >
                            {validationResult.REQ_modalidades_de_pago.REQ_cuota_1 && (
                              <FormControlLabel
                                value="cuota_1"
                                control={<Radio />}
                                label={`Primera Cuota: $${validationResult.REQ_monto_cuota_1_final.toLocaleString()}`}
                              />
                            )}
                            {validationResult.REQ_modalidades_de_pago.REQ_cuota_2 && (
                              <FormControlLabel
                                value="cuota_2"
                                control={<Radio />}
                                label={`Segunda Cuota: $${validationResult.REQ_monto_cuota_2_final.toLocaleString()}`}
                              />
                            )}
                            {validationResult.REQ_modalidades_de_pago.REQ_total && (
                              <FormControlLabel
                                value="total"
                                control={<Radio />}
                                label={`Pago Total: $${validationResult.REQ_monto_final.toLocaleString()}`}
                              />
                            )}
                          </RadioGroup>
                        </Box>
      
                        {paymentMethod && (
                          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography variant="subtitle1" gutterBottom>
                              Desglose de Costos
                            </Typography>
                            <Stack spacing={1}>
                              {paymentMethod === 'cuota_1' && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography>Primera Cuota Permiso de circulación 2025:</Typography>
                                <Typography>${getCostBreakdown()?.base.toLocaleString()}</Typography>
                              </Box>
                              )}
                              {paymentMethod === 'cuota_2' && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography>Segunda Cuota Permiso de circulación 2025:</Typography>
                                  <Typography>${getCostBreakdown()?.base.toLocaleString()}</Typography>
                                </Box>
                              )}
                              {paymentMethod === 'total' && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography>Permiso de circulación 2025 anual:</Typography>
                                  <Typography>${getCostBreakdown()?.base.toLocaleString()}</Typography>
                                </Box>
                              )}
                              {validationResult.REQ_monto_multas > 0 && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography>Multas:</Typography>
                                  <Typography>${validationResult.REQ_monto_multas.toLocaleString()}</Typography>
                                </Box>
                              )}
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: 1, borderColor: 'divider', pt: 1, mt: 1 }}>
                                <Typography variant="subtitle2">Total a Pagar:</Typography>
                                <Typography variant="subtitle2">${getCostBreakdown()?.total.toLocaleString()}</Typography>
                              </Box>
                            </Stack>
                          </Box>
                        )}
      
                        <form onSubmit={handleSubmit}>
                          <Stack spacing={3}>
                            <TextField
                              fullWidth
                              label="Correo electrónico"
                              name="email"
                              type="email"
                              value={formData.email}
                              onChange={handleInputChange}
                              error={!!formErrors.email}
                              helperText={formErrors.email}
                              required
                            />
      
                            <TextField
                              fullWidth
                              label="Número de Teléfono"
                              name="phoneNumber"
                              value={formData.phoneNumber}
                              onChange={handleInputChange}
                              error={!!formErrors.phoneNumber}
                              helperText={formErrors.phoneNumber}
                              required
                            />
      
                            {error && (
                              <Typography color="error" variant="body2">
                                {error}
                              </Typography>
                            )}
      
                            <Button
                              type="submit"
                              variant="contained"
                              size="large"
                              fullWidth
                              disabled={loading || !paymentMethod || formData.email === '' || formData.phoneNumber === ''}
                            >
                              {loading ? (
                                <CircularProgress size={24} color="inherit" />
                              ) : (
                                `Pagar $${getPaymentAmount().toLocaleString()}`
                              )}
                            </Button>
      
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              align="center"
                            >
                              Al hacer clic en "Pagar", serás redirigido al portal de pago
                              seguro
                            </Typography>
                          </Stack>
                        </form>
                      </>
                    )}
                  </>
              </Stack>
            )}
          </StyledPaper>
        </Box>
      </Container>
    );
  }
  