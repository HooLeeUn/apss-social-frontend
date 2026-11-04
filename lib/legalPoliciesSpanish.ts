import { LEGAL_LAST_UPDATED } from "./legal-constants";
import { LegalPoliciesContent, LegalSection } from "./legal";

const userGeneratedContentSection: LegalSection = {
  subtitle: "Contenido generado por usuarios y moderación",
  paragraphs: [
    "RecCool permite a los usuarios crear, publicar e interactuar con contenido generado por usuarios, incluyendo comentarios públicos, Video Reactions, calificaciones, recomendaciones, reacciones y otras interacciones sociales disponibles en la plataforma.",
    "Cada usuario es responsable del contenido que publica y de sus interacciones dentro de RecCool. No se permite publicar contenido ilegal, ofensivo, amenazante, acosador, discriminatorio, sexualmente inapropiado, fraudulento, engañoso, difamatorio, que vulnere derechos de terceros, que exponga información privada de otras personas o que pueda afectar la seguridad de la comunidad.",
    "RecCool dispone de mecanismos para denunciar contenido y usuarios. Dependiendo del tipo de contenido o interacción, los usuarios podrán denunciar comentarios públicos, Video Reactions o cuentas de otros usuarios, seleccionar el motivo de la denuncia y proporcionar información adicional que facilite su revisión.",
    "No todos los tipos de actividad o interacción admiten una denuncia de contenido. Cuando una actividad no corresponda a contenido generado por usuarios susceptible de ser denunciado, el usuario podrá utilizar las opciones disponibles para denunciar o restringir al usuario cuando corresponda.",
    "Las denuncias podrán ser revisadas por administradores autorizados de RecCool. Durante este proceso, una denuncia podrá encontrarse pendiente, en revisión, resuelta o rechazada. La presentación de una denuncia no implica automáticamente que el contenido será eliminado ni que el usuario denunciado haya infringido estas políticas.",
    "Como resultado de una revisión, RecCool podrá mantener, limitar, ocultar o eliminar contenido, así como adoptar medidas sobre una cuenta cuando determine que existe una infracción de estas políticas, de la ley aplicable, de los derechos de terceros o de las normas de seguridad y convivencia de la plataforma.",
    "RecCool también permite restringir usuarios. Cuando un usuario restringe a otro, la restricción funciona de manera bilateral: mientras permanezca activa, ninguno de los dos podrá acceder al perfil ni visualizar el contenido del otro dentro de las áreas de la plataforma sujetas a esta restricción. La restricción podrá retirarse posteriormente desde la sección “Privacidad y Seguridad”.",
    "Denunciar a un usuario, denunciar contenido y restringir a un usuario son funciones diferentes. Una denuncia solicita que RecCool revise una posible infracción, mientras que una restricción controla la interacción y visibilidad entre dos usuarios.",
    "El uso abusivo, fraudulento o deliberadamente falso de las herramientas de denuncia podrá dar lugar a medidas sobre la cuenta que realice dicho uso.",
    "RecCool podrá adoptar medidas adicionales frente a infracciones graves o reiteradas, incluyendo limitaciones de funcionalidades, suspensión temporal o permanente de cuentas u otras acciones razonablemente necesarias para proteger a los usuarios y a la comunidad.",
    "Al publicar contenido en RecCool, el usuario declara que cuenta con los derechos necesarios para compartirlo y que dicho contenido no vulnera derechos de autor, privacidad, imagen, propiedad intelectual u otros derechos de terceros.",
  ],
};

const removeSectionNumber = (subtitle: string) => subtitle.replace(/^\s*\d+\.\s*/, "");

const privacyAdditions: Record<string, string[]> = {
  "eliminación de contenido y cuentas": [
    "El usuario autenticado puede eliminar permanentemente su cuenta desde Datos Personales → Eliminar cuenta, confirmando con su contraseña actual. También puede solicitar la eliminación sin iniciar sesión en https://reccool.com/delete-account: debe indicar el correo de la cuenta y, si existe una cuenta activa asociada, recibirá un enlace por correo para confirmar la eliminación. Solicitar el enlace no elimina la cuenta; es necesario confirmar la acción. Por seguridad, la respuesta pública no revela si el correo está registrado.",
    "La eliminación borra la cuenta, el perfil, las calificaciones, los comentarios públicos y dirigidos escritos por el usuario, los mensajes privados de su autoría, las video reacciones, los likes y dislikes, las listas, las preferencias, las recomendaciones y las relaciones de seguimiento y amistad vinculadas. También elimina los mensajes del formulario Contáctenos almacenados en la aplicación. Los comentarios o mensajes escritos por otras personas pueden permanecer, aunque se retire su vínculo como destinatario con la cuenta eliminada; las menciones incluidas en su texto no se borran automáticamente.",
    "Al completarse la eliminación de los registros, RecCool solicita al almacenamiento la eliminación del avatar y de las imágenes y videos asociados, incluido el audio contenido en los videos. Un fallo del proveedor de almacenamiento puede impedir que un archivo se elimine en ese momento.",
    "No se aplica un período adicional de retención a los datos de la cuenta que este proceso elimina. Pueden permanecer registros técnicos de solicitudes de eliminación sin vínculo con la cuenta, información agregada y correspondencia ya enviada por correo. La información técnica o los registros que deban conservarse por obligaciones legales, seguridad, prevención del fraude o resolución de incidencias se limitan a lo necesario para esa finalidad. No se establece aquí un plazo fijo para esos registros ni para copias de seguridad de proveedores.",
  ],
  "tratamiento de datos personales": [
    "Información de registro: RecCool recopila nombre, apellido, nombre de usuario, correo electrónico y fecha de nacimiento, así como la aceptación y versión de los términos. Las contraseñas se almacenan mediante funciones de hash de Django; se utilizan credenciales y tokens para autenticar y proteger el acceso a la cuenta y para los procesos de confirmación y recuperación.",
    "Información del perfil: se almacenan la biografía, el avatar, el país seleccionado para consultar disponibilidad de películas y series, la fecha de nacimiento de la que se deriva la edad, la identidad de género opcional y las opciones de visibilidad. Ocultar la edad o la identidad de género en el perfil no elimina el dato almacenado por RecCool.",
    "Información social y contenido: se tratan comentarios públicos, comentarios dirigidos y mensajes privados entre usuarios, calificaciones, likes y dislikes, videos de reacción y su audio, seguidores, solicitudes de amistad, amistades, listas de películas y series, favoritos, recomendaciones y preferencias cinematográficas. Su visibilidad depende del tipo de contenido, sus destinatarios y las opciones de privacidad disponibles.",
    "Estos datos permiten crear y administrar cuentas, autenticar usuarios, proteger el acceso, mostrar perfiles y relaciones sociales, publicar contenido, facilitar comunicaciones entre usuarios y personalizar recomendaciones a partir de calificaciones, preferencias y actividad. También se procesan motivos, detalles y estados de denuncias para su revisión por administradores autorizados y la moderación. No se describe un uso de estos datos para publicidad ni seguimiento entre aplicaciones.",
    "Para atender solicitudes desde https://reccool.com/contact se requiere iniciar sesión. Se almacenan la cuenta asociada, categoría, asunto, mensaje y estado del envío; el correo dirigido al equipo de RecCool incluye el nombre de usuario, correo electrónico y contenido de la solicitud. Los servicios de correo configurados procesan asimismo los mensajes de confirmación de registro, recuperación, cambio de correo y eliminación de cuenta.",
    "Almacenamiento y proveedores: la aplicación utiliza PostgreSQL para los registros y admite Cloudflare R2 para avatares, imágenes y videos cuando está configurado. Los proveedores de alojamiento de la aplicación y de la base de datos procesan los datos necesarios para prestar el servicio; la documentación del backend contempla su operación en Render. La identidad del proveedor de correo y la configuración efectiva del alojamiento dependen del entorno de operación.",
    "TMDb proporciona información cinematográfica y referencias de contenido audiovisual; las consultas del catálogo no requieren enviar nombre, correo ni contraseña del usuario. Los tráileres se reproducen mediante YouTube o se abren en su sitio; al cargar contenido externo, el dispositivo establece una conexión con ese proveedor, que puede recibir datos técnicos como la dirección IP y datos del navegador. Estos servicios externos tienen sus propias políticas de privacidad y no cumplen la misma función que el almacenamiento de cuentas de RecCool.",
    "Conservación y derechos: los datos se conservan para las finalidades descritas mientras la cuenta y las funciones correspondientes estén en uso, y se eliminan mediante las vías y con las salvedades del apartado 7. No se fija un plazo general de conservación. El usuario puede consultar sus datos y editar los campos habilitados en Datos Personales y su perfil, gestionar visibilidad en Datos Personales y Privacidad y Seguridad, y solicitar eliminación por las dos vías descritas. La fecha de nacimiento queda bloqueada una vez confirmada y el cambio de correo requiere confirmación. Para consultas, rectificaciones no disponibles en pantalla, revocación de autorización u otras solicitudes de privacidad, puede usar https://reccool.com/contact con sesión iniciada. Estos mecanismos no limitan los derechos legales antes indicados.",
  ],
};

export function prepareSpanishLegalPolicies(content: LegalPoliciesContent): LegalPoliciesContent {
  const existingSections = content.sections.filter(
    (section) => removeSectionNumber(section.subtitle).toLocaleLowerCase("es") !== userGeneratedContentSection.subtitle.toLocaleLowerCase("es"),
  );
  const conductIndex = existingSections.findIndex(
    (section) => removeSectionNumber(section.subtitle).toLocaleLowerCase("es") === "conducta y contenido",
  );
  const insertionIndex = conductIndex >= 0 ? conductIndex + 1 : 4;
  const sections = [
    ...existingSections.slice(0, insertionIndex),
    userGeneratedContentSection,
    ...existingSections.slice(insertionIndex),
  ].map((section, index) => ({
    ...section,
    paragraphs: [
      ...section.paragraphs,
      ...(privacyAdditions[removeSectionNumber(section.subtitle).toLocaleLowerCase("es")] ?? []),
    ],
    subtitle: `${index + 1}. ${removeSectionNumber(section.subtitle)}`,
  }));

  return { ...content, lastUpdated: LEGAL_LAST_UPDATED, sections };
}
